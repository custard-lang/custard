import {
  type Context,
  type TranspileRepl,
  type Block,
  markAsFunctionWithContext,
  markAsDirectWriter,
  TranspileError,
  type Ktvals,
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
  ReadStringOptions,
} from "../types.js";
import { evalBlock, evalForm } from "../internal/eval.js";
import {
  findIdAsJsSrc,
  isAtTopLevel,
  referTo,
  srcPathForErrorMessage,
} from "../internal/context.js";

import type { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";
import { standardModuleRoot } from "../definitions.js";
import {
  transpileExpression,
  transpilePropertyAccessReference,
  transpileSymbolReference,
} from "../internal/transpile.js";

import { buildAsyncFn, buildFn, tryToSet } from "./internal.js";
import {
  defaultScopeOptions,
  exportableStatement,
  isMacro,
  ktvalAssignSimple,
  ktvalOther,
  MarkedDirectWriter,
  readerInput,
} from "../internal/types.js";
import { ExpectNever } from "../util/error.js";
import { evalForMacro } from "../internal/eval/core.js";
import { evalKtvals } from "../internal/ktvals.js";

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
  reservedSymbol,
  cuString as string,
  isKeyValue,
  keyValue,
  markAsMacro as _$cu_markAsMacro,
} from "../types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO: Make readString context-free
export const readString = markAsFunctionWithContext(
  (
    context: Context,
    contents?: string,
    options?: ReadStringOptions,
  ): Block | ParseError<Form> => {
    if (contents === undefined) {
      throw new Error("No string given to `readString`!");
    }

    const defaultPathAndStat = srcPathForErrorMessage(context);
    const path = options?.path ?? defaultPathAndStat.path;
    const line = options?.line ?? 1;
    const isDirectory = options?.isDirectory ?? defaultPathAndStat.isDirectory;
    return readBlock(readerInput({ path, isDirectory }, contents, line));
  },
);

export const evaluate = markAsFunctionWithContext(
  (context: Context, formOrBlock?: Form | Block): any | Error => {
    if (formOrBlock === undefined) {
      throw new Error("No form or block given to `evaluate`!");
    }
    if (context.transpileState.mode === "repl") {
      // Dirty workaround for https://github.com/microsoft/TypeScript/issues/42384
      const context_ = context as Context<TranspileRepl>;
      if (Array.isArray(formOrBlock)) {
        return evalBlock(formOrBlock, context_);
      }
      return evalForm(formOrBlock, context_);
    }
    throw new Error(
      "Sorry, user `evaluate` function is currently only available in `repl` mode",
    );
  },
);

function buildDefineMacro(
  formId: string,
  body: (
    name: CuSymbol,
    context: Context,
    args: Form | undefined,
    block: Form[],
  ) => Promise<Ktvals<JsSrc> | TranspileError>,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      context: Context,
      name?: Form,
      args?: Form,
      ...block: Form[]
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      if (!isAtTopLevel(context)) {
        return new TranspileError(
          `\`${formId}\` can only be used at the top level of a module.`,
        );
      }

      if (name === undefined) {
        return new TranspileError(
          "`meta.defineMacro`needs a name of the macro",
        );
      }
      if (!isCuSymbol(name)) {
        return new TranspileError(
          `\`${formId}\` needs a name of the macro as a symbol, but got ${formatForError(name)}`,
        );
      }

      const evalResult = await evalForMacro(context);
      if (TranspileError.is(evalResult)) {
        return evalResult;
      }

      const fnSrc = await body(name, context, args, block);
      if (TranspileError.is(fnSrc)) {
        return fnSrc;
      }
      const metaModuleJsId = await findThisModulesJsId(
        context,
        "_$cu_markAsMacro",
      );
      return [
        ktvalAssignSimple("const ", name.value, [
          ...metaModuleJsId,
          ktvalOther("("),
          ...fnSrc,
          ktvalOther(")"),
        ]),
      ];
    },
    exportableStatement,
  );
}

export const defineMacro = buildDefineMacro(
  "meta.defineMacro",
  async (
    name: CuSymbol,
    context: Context,
    args: Form | undefined,
    block: Form[],
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const fnSrc = await buildFn(
      "meta.defineMacro",
      context,
      null,
      args,
      block,
      defaultScopeOptions,
      "function",
    );
    if (TranspileError.is(fnSrc)) {
      return fnSrc;
    }
    const fn = (await evalKtvals([], fnSrc, context)) as (
      ...xs: any[]
    ) => any | TranspileError;
    const r = tryToSet(name, context, () => {
      return markAsMacro((...args: Form[]): Form | TranspileError => {
        try {
          return fn(...args);
        } catch (e) {
          return new TranspileError(
            `Error when expanding the macro ${name.value}`,
            { cause: e },
          );
        }
      });
    });
    if (TranspileError.is(r)) {
      return r;
    }
    return fnSrc;
  },
);

export const defineAsyncMacro = buildDefineMacro(
  "meta.defineAsyncMacro",
  async (
    name: CuSymbol,
    context: Context,
    args: Form | undefined,
    block: Form[],
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const fnSrc = await buildAsyncFn(
      "meta.defineAsyncMacro",
      context,
      null,
      args,
      block,
    );
    if (TranspileError.is(fnSrc)) {
      return fnSrc;
    }
    const fn = (await evalKtvals([], fnSrc, context)) as (
      ...xs: any[]
    ) => Promise<any | TranspileError>;
    const r = tryToSet(name, context, () => {
      return markAsMacro(
        async (...args: Form[]): Promise<Form | TranspileError> => {
          try {
            return await fn(...args);
          } catch (e) {
            return new TranspileError(
              `Error when expanding the macro ${name.value}`,
              { cause: e },
            );
          }
        },
      );
    });
    if (TranspileError.is(r)) {
      return r;
    }
    return fnSrc;
  },
);

export const macroToFunction = markAsDirectWriter(
  (
    context: Context,
    macroId?: Form,
    ...forms: Form[]
  ): Ktvals<JsSrc> | TranspileError => {
    if (macroId === undefined || forms.length !== 0) {
      return new TranspileError(
        "The number of arguments of `meta.macroToFunction` must be 1",
      );
    }
    const isSym = isCuSymbol(macroId);
    const isPa = !isPropertyAccess(macroId);
    if (!isSym && isPa) {
      return new TranspileError(
        `The first argument of \`meta.macroToFunction\` must be a Symbol or PropertyAccess, but got ${formatForError(macroId)}.`,
      );
    }

    const foundMacro = referTo(context, macroId);
    if (foundMacro instanceof TranspileError) {
      return foundMacro;
    }
    if (!isMacro(foundMacro.writer)) {
      return new TranspileError(
        `The given id does not refer to a macro: ${formatForError(macroId)}.`,
      );
    }

    const srcRefer = isSym
      ? transpileSymbolReference(foundMacro, macroId)
      : transpilePropertyAccessReference(foundMacro, macroId);
    return [...srcRefer, ktvalOther(".expand")];
  },
);

export const quote = markAsDirectWriter(
  async (
    context: Context,
    ...forms: Block
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const [form] = forms;
    if (forms.length !== 1 || form === undefined) {
      return new TranspileError("quote expects exactly one form");
    }
    if (isUnquote(form)) {
      return await quoteUnquote(form, context);
    }
    return await traverse(form, context, false);
  },
);

export const quasiQuote = markAsDirectWriter(
  async (
    context: Context,
    ...forms: Block
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const [form] = forms;
    if (forms.length !== 1 || form === undefined) {
      return new TranspileError("quasiQuote expects exactly one form");
    }
    return await traverse(form, context, true);
  },
);

async function traverse(
  form: Form,
  context: Context,
  unquote: boolean,
): Promise<Ktvals<JsSrc> | TranspileError> {
  if (isList(form)) {
    return await traverseList(form, context, unquote);
  }
  if (isCuArray(form)) {
    return await traverseArray(form, context, unquote);
  }
  if (isCuObject(form)) {
    return await traverseCuObject(form, context, unquote);
  }

  if (isUnquote(form)) {
    if (unquote) {
      // TODO: Error if not in an unquote
      return await transpileExpression(form.value, context);
    }
    return await quoteUnquote(form, context);
  }
  if (isSplice(form)) {
    if (unquote) {
      return await traverseSplice(form, context, unquote);
    }
    return await quoteSplice(form, context);
  }
  if (isPropertyAccess(form)) {
    return await quotePropertyAccess(form, context);
  }
  if (isCuSymbol(form)) {
    return await quoteCuSymbol(form, context);
  }
  if (isInteger32(form)) {
    return await quoteValueOf(form, context, "integer32");
  }
  if (isFloat64(form)) {
    return await quoteValueOf(form, context, "float64");
  }
  if (isCuString(form)) {
    return await quoteValueOf(form, context, "string");
  }
  if (isReservedSymbol(form)) {
    return await quoteValueOf(form, context, "reservedSymbol");
  }
  throw ExpectNever(form);
}

async function traverseList(
  form: List<Form>,
  context: Context,
  unquote: boolean,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const elementsSrc = await mapJoinE(
    form.values,
    async (f) => await traverse(f, context, unquote),
  );
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(context, "list");
  return [...funcSrc, ktvalOther("("), ...elementsSrc, ktvalOther(")")];
}

async function traverseArray(
  form: Form[],
  context: Context,
  unquote: boolean,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const elementsSrc = await mapJoinE(
    form,
    async (f) => await traverse(f, context, unquote),
  );
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(context, "array");
  return [...funcSrc, ktvalOther("("), ...elementsSrc, ktvalOther(")")];
}

async function traverseCuObject(
  form: CuObject<Form, Form, Form, Form>,
  context: Context,
  unquote: boolean,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const elementsSrc = await mapJoinE(
    form.keyValues,
    async (f): Promise<Ktvals<JsSrc> | TranspileError> => {
      if (isKeyValue(f)) {
        return await traverseKeyValue(f, context, unquote);
      }
      return await traverse(f, context, unquote);
    },
  );
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  const funcSrc = await findThisModulesJsId(context, "object");
  return [...funcSrc, ktvalOther("("), ...elementsSrc, ktvalOther(")")];
}

async function traverseKeyValue(
  f: KeyValue<Form, Form, Form>,
  context: Context,
  unquote: boolean,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const keySrc = isComputedKey(f.key)
    ? await traverseComputedKey(f.key, context, unquote)
    : await traverse(f.key, context, unquote);
  if (TranspileError.is(keySrc)) {
    return keySrc;
  }

  const valueSrc = await traverse(f.value, context, unquote);
  if (TranspileError.is(valueSrc)) {
    return valueSrc;
  }

  const funcSrc = await findThisModulesJsId(context, "keyValue");
  return [
    ...funcSrc,
    ktvalOther("("),
    ...keySrc,
    ktvalOther(","),
    ...valueSrc,
    ktvalOther(")"),
  ];
}

async function traverseComputedKey(
  form: ComputedKey<Form>,
  context: Context,
  unquote: boolean,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = await traverse(form.value, context, unquote);
  if (TranspileError.is(r)) {
    return r;
  }
  return [ktvalOther("("), ...r, ktvalOther("]")];
}

async function quoteUnquote(
  form: Unquote<Form>,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const elementSrc = await traverse(form.value, context, false);
  if (TranspileError.is(elementSrc)) {
    return elementSrc;
  }
  const funcSrc = await findThisModulesJsId(context, "unquote");
  return [...funcSrc, ktvalOther("("), ...elementSrc, ktvalOther(")")];
}

// TODO: Error if not in a list, array or object
async function traverseSplice(
  form: Splice<Form>,
  context: Context,
  unquote: boolean,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const s = await traverse(form.value, context, unquote);
  if (TranspileError.is(s)) {
    return s;
  }
  return [ktvalOther("..."), ...s];
}

async function quotePropertyAccess(
  form: PropertyAccess,
  context: Context,
): Promise<Ktvals<JsSrc>> {
  const elementsSrc = form.value.map((id) => JSON.stringify(id)).join(",");
  const funcSrc = await findThisModulesJsId(context, "propertyAccess");
  return [...funcSrc, ktvalOther(`(${elementsSrc})`)];
}

async function quoteCuSymbol(
  form: CuSymbol,
  context: Context,
): Promise<Ktvals<JsSrc>> {
  const elementsSrc = JSON.stringify(form.value);
  const funcSrc = await findThisModulesJsId(context, "symbol");
  return [...funcSrc, ktvalOther(`(${elementsSrc})`)];
}

async function quoteValueOf(
  form: Integer32 | Float64 | CuString | ReservedSymbol,
  context: Context,
  constructorId: Id,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const elementsSrc = JSON.stringify(form.valueOf());
  const funcSrc = await findThisModulesJsId(context, constructorId);
  return [...funcSrc, ktvalOther(`(${elementsSrc})`)];
}

async function quoteSplice(
  form: Splice<Form>,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const elementSrc = await traverse(form.value, context, false);
  if (TranspileError.is(elementSrc)) {
    return elementSrc;
  }
  const funcSrc = await findThisModulesJsId(context, "splice");
  return [...funcSrc, ktvalOther("("), ...elementSrc, ktvalOther(")")];
}

async function mapJoinE<T>(
  xs: T[],
  f: (x: T) => Promise<Ktvals<JsSrc> | TranspileError>,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const result: Ktvals<JsSrc> = [];
  for (const x of xs) {
    const r = await f(x);
    if (TranspileError.is(r)) {
      return r;
    }
    result.push(...r, ktvalOther(","));
  }
  return result;
}

async function findThisModulesJsId(
  context: Context,
  id: Id,
): Promise<Ktvals<JsSrc>> {
  const r = await findIdAsJsSrc(context, metaModulePath, id);
  if (r == null) {
    throw new TranspileError(
      "Assertion failed: Cannot find the standard `meta` module!",
    );
  }

  return r;
}
const metaModulePath = `${standardModuleRoot}meta.js`;
