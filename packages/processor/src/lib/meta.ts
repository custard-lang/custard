import {
  type Env,
  type TranspileRepl,
  type Block,
  markAsFunctionWithEnv,
  type FilePath,
  markAsDirectWriter,
  TranspileError,
  type JsSrc,
  type Form,
  isUnquote,
  isSplice,
  isCuArray,
  isList,
  isCuObject,
  type List,
  type CuObject,
  type CuSymbol,
  type Unquote,
  type Splice,
  type PropertyAccess,
  type KeyValue,
  isPropertyAccess,
  isCuSymbol,
  type Id,
  markAsMacro,
  formatForError,
  isKeyValue,
  isComputedKey,
  type ComputedKey,
  isInteger32,
  isFloat64,
  isCuString,
  isReservedSymbol,
  type Integer32,
  type Float64,
  type CuString,
  type ReservedSymbol,
} from "../types.js";
import { evalBlock, evalForm } from "../internal/eval.js";
import { findIdAsJsSrc, srcPathForErrorMessage } from "../internal/env.js";

import type { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";
import { standardModuleRoot } from "../definitions.js";
import { transpileExpression } from "../internal/transpile.js";

import { buildAsyncFn } from "./common.js";
import { ordinaryStatement } from "../internal/types.js";
import { tryToSet } from "./base/common.js";
import { _cu$eval } from "../internal/isolated-eval.js";
import type { Awaitable } from "../util/types.js";
import { ExpectNever } from "../util/error.js";

export { transpileModule } from "../transpile.js";
export {
  cuArray as array,
  cuObject as object,
  list,
  unquote,
  splice,
  propertyAccess,
  cuSymbol as symbol,
  integer32,
  float64,
  cuString as string,
  isKeyValue,
  keyValue,
} from "../types.js";

export const readString = markAsFunctionWithEnv(
  (
    env: Env,
    contents?: string,
    path: FilePath = srcPathForErrorMessage(env),
  ): Block | ParseError => {
    if (contents === undefined) {
      throw new Error("No string given to `readString`!");
    }

    return readBlock({ contents, path });
  },
);

export const evaluate = markAsFunctionWithEnv(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (env: Env, formOrBlock?: Form | Block): any | Error => {
    if (formOrBlock === undefined) {
      throw new Error("No form or block given to `evaluate`!");
    }
    if (env.transpileState.mode === "repl") {
      // Dirty workaround for https://github.com/microsoft/TypeScript/issues/42384
      const env_ = env as Env<TranspileRepl>;
      if (Array.isArray(formOrBlock)) {
        return evalBlock(formOrBlock, env_);
      }
      return evalForm(formOrBlock, env_);
    }
    throw new Error(
      "Sorry, user `evaluate` function is currently only available in `repl` mode",
    );
  },
);

export const macro = markAsDirectWriter(
  async (
    env: Env,
    name?: Form,
    args?: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    if (name === undefined) {
      return new TranspileError("meta.macro needs a name of the macro");
    }
    if (!isCuSymbol(name)) {
      return new TranspileError(
        `meta.macro needs a name of the macro as a symbol, but got ${formatForError(name)}`,
      );
    }

    const fnSrc = await buildAsyncFn("macro", env, null, args, block);
    if (TranspileError.is(fnSrc)) {
      return fnSrc;
    }

    const fn = (await _cu$eval("", fnSrc, env)) as (
      ...args: Form[]
    ) => Awaitable<Form | TranspileError>;
    const r = tryToSet(name, env, () => {
      return markAsMacro(
        async (_env: Env, ...args: Form[]): Promise<Form | TranspileError> =>
          await fn(...args),
      );
    });
    if (r instanceof TranspileError) {
      return r;
    }

    // Generated function is just stored in env. No need to return the source code.
    return "";
  },
  ordinaryStatement,
);

export const quote = markAsDirectWriter(
  async (env: Env, ...forms: Block): Promise<JsSrc | TranspileError> => {
    const [form] = forms;
    if (forms.length !== 1 || form === undefined) {
      return new TranspileError("quote expects exactly one form");
    }
    if (isUnquote(form)) {
      return await quoteUnquote(form, env);
    }
    return await traverse(form, env, false);
  },
);

export const quasiQuote = markAsDirectWriter(
  async (env: Env, ...forms: Block): Promise<JsSrc | TranspileError> => {
    const [form] = forms;
    if (forms.length !== 1 || form === undefined) {
      return new TranspileError("quasiQuote expects exactly one form");
    }
    return await traverse(form, env, true);
  },
);

async function traverse(
  form: Form,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  if (isList(form)) {
    return await traverseList(form, env, unquote);
  }
  if (isCuArray(form)) {
    return await traverseArray(form, env, unquote);
  }
  if (isCuObject(form)) {
    return await traverseCuObject(form, env, unquote);
  }

  if (isUnquote(form)) {
    if (unquote) {
      // TODO: Error if not in an unquote
      return await transpileExpression(form.value, env);
    }
    return await quoteUnquote(form, env);
  }
  if (isSplice(form)) {
    if (unquote) {
      return await traverseSplice(form, env, unquote);
    }
    return await quoteSplice(form, env);
  }
  if (isPropertyAccess(form)) {
    return await quotePropertyAccess(form, env);
  }
  if (isCuSymbol(form)) {
    return await quoteCuSymbol(form, env);
  }
  if (isInteger32(form)) {
    return await quoteValueOf(form, env, "integer32");
  }
  if (isFloat64(form)) {
    return await quoteValueOf(form, env, "float64");
  }
  if (isCuString(form)) {
    return await quoteValueOf(form, env, "string");
  }
  if (isReservedSymbol(form)) {
    return await quoteValueOf(form, env, "reservedSymbol");
  }
  throw ExpectNever(form);
}

async function traverseList(
  form: List<Form>,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const elementsSrc = await mapJoinE(
    form.values,
    async (f) => await traverse(f, env, unquote),
  );
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "list");
  return `${funcSrc}(${elementsSrc})`;
}

async function traverseArray(
  form: Form[],
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const elementsSrc = await mapJoinE(
    form,
    async (f) => await traverse(f, env, unquote),
  );
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "array");
  return `${funcSrc}(${elementsSrc})`;
}

async function traverseCuObject(
  form: CuObject<Form, Form, Form, Form>,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const elementsSrc = await mapJoinE(
    form.keyValues,
    async (f): Promise<JsSrc | TranspileError> => {
      if (isKeyValue(f)) {
        return await traverseKeyValue(f, env, unquote);
      }
      return await traverse(f, env, unquote);
    },
  );
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "object");
  return `${funcSrc}(${elementsSrc})`;
}

async function traverseKeyValue(
  f: KeyValue<Form, Form, Form>,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const keySrc = isComputedKey(f.key)
    ? await traverseComputedKey(f.key, env, unquote)
    : await traverse(f.key, env, unquote);
  if (TranspileError.is(keySrc)) {
    return keySrc;
  }

  const valueSrc = await traverse(f.value, env, unquote);
  if (TranspileError.is(valueSrc)) {
    return valueSrc;
  }

  const funcSrc = await findThisModulesJsId(env, "keyValue");
  return `${funcSrc}(${keySrc},${valueSrc})`;
}

async function traverseComputedKey(
  form: ComputedKey<Form>,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const r = await traverse(form.value, env, unquote);
  if (TranspileError.is(r)) {
    return r;
  }
  return `[${r}]`;
}

async function quoteUnquote(
  form: Unquote<Form>,
  env: Env,
): Promise<JsSrc | TranspileError> {
  const elementSrc = await traverse(form.value, env, false);
  if (TranspileError.is(elementSrc)) {
    return elementSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "unquote");
  return `${funcSrc}(${elementSrc})`;
}

// TODO: Error if not in a list, array or object
async function traverseSplice(
  form: Splice<Form>,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const s = await traverse(form.value, env, unquote);
  if (TranspileError.is(s)) {
    return s;
  }
  return `...${s}`;
}

async function quotePropertyAccess(
  form: PropertyAccess,
  env: Env,
): Promise<JsSrc> {
  const elementsSrc = form.value.map((id) => JSON.stringify(id)).join(",");
  const funcSrc = await findThisModulesJsId(env, "propertyAccess");
  return `${funcSrc}(${elementsSrc})`;
}

async function quoteCuSymbol(form: CuSymbol, env: Env): Promise<JsSrc> {
  const elementsSrc = JSON.stringify(form.value);
  const funcSrc = await findThisModulesJsId(env, "symbol");
  return `${funcSrc}(${elementsSrc})`;
}

async function quoteValueOf(
  form: Integer32 | Float64 | CuString | ReservedSymbol,
  env: Env,
  constructorId: Id,
): Promise<JsSrc | TranspileError> {
  const elementsSrc = JSON.stringify(form.valueOf());
  const funcSrc = await findThisModulesJsId(env, constructorId);
  return `${funcSrc}(${elementsSrc})`;
}

async function quoteSplice(
  form: Splice<Form>,
  env: Env,
): Promise<JsSrc | TranspileError> {
  const elementSrc = await traverse(form.value, env, false);
  if (TranspileError.is(elementSrc)) {
    return elementSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "splice");
  return `${funcSrc}(${elementSrc})`;
}

async function mapJoinE<T>(
  xs: T[],
  f: (x: T) => Promise<JsSrc | TranspileError>,
): Promise<JsSrc | TranspileError> {
  let result = "";
  for (const x of xs) {
    const r = await f(x);
    if (TranspileError.is(r)) {
      return r;
    }
    result = `${result}${r},`;
  }
  return result;
}

async function findThisModulesJsId(env: Env, id: Id): Promise<JsSrc> {
  const r = await findIdAsJsSrc(env, metaModulePath, id);
  if (r == null) {
    throw new TranspileError(
      "Assertion failed: Cannot find the standard `meta` module!",
    );
  }

  return r;
}
const metaModulePath = `${standardModuleRoot}meta.js`;
