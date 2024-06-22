import {
  Env,
  TranspileRepl,
  Block,
  markAsFunctionWithEnv,
  FilePath,
  markAsDirectWriter,
  TranspileError,
  JsSrc,
  Form,
  isUnquote,
  isSplice,
  isLiteralArray,
  isList,
  isLiteralObject,
  LiteralList,
  LiteralObject,
  LiteralArray,
  List,
  CuSymbol,
  Unquote,
  Splice,
  PropertyAccess,
  isPropertyAccess,
  isCuSymbol,
  LiteralUnquote,
  LiteralSplice,
  LiteralPropertyAccess,
  LiteralCuSymbol,
  KeyValues,
  Id,
} from "../types.js";
import { evalBlock, evalForm } from "../internal/eval.js";
import { findIdAsJsSrc, srcPathForErrorMessage } from "../internal/env.js";

import type { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";
import { standardModuleRoot } from "../definitions.js";
import { transpileExpression } from "../internal/transpile.js";

export { transpileModule } from "../transpile.js";

export const readString = markAsFunctionWithEnv(
  (
    env: Env,
    contents: string,
    path: FilePath = srcPathForErrorMessage(env),
  ): Block | ParseError => {
    return readBlock({ contents, path });
  },
);

export const evaluate = markAsFunctionWithEnv(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (env: Env, formOrBlock: Form | Block): any | Error => {
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
  async (
    env: Env,
    ...forms: Block
  ): Promise<JsSrc | TranspileError> => {
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
  if (isLiteralArray(form)) {
    return await traverseLiteralArray(form, env, unquote);
  }
  if (isLiteralObject(form)) {
    return await traverseLiteralObject(form, env, unquote);
  }
  if (isUnquote(form)) {
    if (unquote) {
      // TODO: Error if not in an unquote
      return await transpileExpression(form.v, env);
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
  return JSON.stringify(form.v);
}

async function traverseList(form: LiteralList, env: Env, unquote: boolean): Promise<JsSrc | TranspileError> {
  const elementsSrc = await mapJoinE(form.v, async (f) => await traverse(f, env, unquote));
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "list");
  return `${funcSrc}(${elementsSrc})`;
}

async function traverseLiteralArray(
  form: LiteralArray,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  return await doTraverseLiteralArray(form.v, env, unquote);
}

async function doTraverseLiteralArray(forms: Array<Form>, env: Env, unquote: boolean): Promise<JsSrc | TranspileError> {
  const elementsSrc = await mapJoinE(forms, async (f) => await traverse(f, env, unquote));
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  return `[${elementsSrc}]`;
}

async function traverseLiteralObject(
  form: LiteralObject,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const elementsSrc = await mapJoinE(form.v, async (f): Promise<JsSrc | TranspileError> => {
    if (Array.isArray(f)) {
      return await doTraverseLiteralArray(f, env, unquote);
    }
    return await traverse(f, env, unquote);
  });
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "keyValues");
  return `${funcSrc}(${elementsSrc})`;
}

async function quoteUnquote(
  form: LiteralUnquote,
  env: Env,
): Promise<JsSrc | TranspileError> {
  const elementSrc = await traverse(form.v, env, false);
  if (TranspileError.is(elementSrc)) {
    return elementSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "unquote");
  return `${funcSrc}(${elementSrc})`;
}

// TODO: Error if not in a list, array or object
async function traverseSplice(
  form: LiteralSplice,
  env: Env,
  unquote: boolean,
): Promise<JsSrc | TranspileError> {
  const s = await traverse(form.v, env, unquote);
  if (TranspileError.is(s)) {
    return s;
  }
  return `...${s}`;
}

async function quotePropertyAccess(form: LiteralPropertyAccess, env: Env): Promise<JsSrc> {
  const elementsSrc = form.v.map((id) => JSON.stringify(id)).join(",");
  const funcSrc = await findThisModulesJsId(env, "propertyAccess");
  return `${funcSrc}(${elementsSrc})`;
}

async function quoteCuSymbol(form: LiteralCuSymbol, env: Env): Promise<JsSrc> {
  const elementsSrc = JSON.stringify(form.v);
  const funcSrc = await findThisModulesJsId(env, "symbol");
  return `${funcSrc}(${elementsSrc})`;
}

async function quoteSplice(
  form: LiteralSplice,
  env: Env,
): Promise<JsSrc | TranspileError> {
  const elementSrc = await traverse(form.v, env, false);
  if (TranspileError.is(elementSrc)) {
    return elementSrc;
  }
  const funcSrc = await findThisModulesJsId(env, "splice");
  return `${funcSrc}(${elementSrc})`;
}

export function list<T>(...items: T[]): List<T> {
  return List.of(...items);
}

export function symbol(name: string): CuSymbol {
  return new CuSymbol(name);
}

export function keyValues<K, V>(...kvs: Array<[K, V] | K>): KeyValues<K, V> {
  return new KeyValues(kvs);
}

export function propertyAccess(...value: string[]): PropertyAccess {
  return new PropertyAccess(value);
}

export function unquote<T>(value: T): Unquote<T> {
  return new Unquote(value);
}

export function splice<T>(value: T): Splice<T> {
  return new Splice(value);
}

async function mapJoinE<T>(xs: T[], f: (x: T) => Promise<JsSrc | TranspileError>): Promise<JsSrc | TranspileError> {
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
    throw new TranspileError("Assertion failed: Cannot find the standard `meta` module!");
  }

  return r;
}
const metaModulePath = `${standardModuleRoot}meta.js`;
