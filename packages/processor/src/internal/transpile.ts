import { ExpectNever } from "../util/error.js";

import {
  type Block,
  type ComputedKey,
  type CuObject,
  type CuSymbol,
  type Form,
  isComputedKey,
  isConst,
  isCuArray,
  isCuObject,
  isCuString,
  isCuSymbol,
  isFloat64,
  isInteger32,
  isKeyValue,
  isList,
  isPropertyAccess,
  isReservedSymbol,
  isSplice,
  isUnquote,
  type JsSrc,
  type PropertyAccess,
  type ReaderInput,
  showSymbolAccess,
  TranspileError,
} from "../types.js";
import {
  type Context,
  type DynamicVar,
  formatForError,
  isContextualKeyword,
  isDynamicVar,
  isMacro,
  isMarkedDirectWriter,
  isMarkedFunctionWithContext,
  isNamespace,
  isProvidedConst,
  isRecursiveConst,
  isVar,
  jsValueToForm,
  ktvalContext,
  ktvalOther,
  ktvalRefer,
  type Ktvals,
  type TranspileModule,
  type Writer,
} from "./types.js";
import * as ContextF from "./context.js";
import { readBlock } from "../reader.js";
import { isParseError } from "../grammar.js";
import { asStatement } from "./call.js";
import { evalForMacro, evalForMacroArgument } from "./eval/core.js";
import { clearTranspiledSrc } from "./transpile-state.js";

export async function transpileExpression(
  ast: Form,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = await transpileExpressionWithNextCall(ast, context);
  if (TranspileError.is(r)) {
    return r;
  }
  const [ktvals, _] = r;
  return ktvals;
}

export async function transpileStatements(
  asts: Form[],
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const result: Ktvals<JsSrc> = [];
  for (const ast of asts) {
    const r = await transpileExpression(ast, context);
    if (TranspileError.is(r)) {
      return r;
    }
    result.push(...r, ktvalOther(";\n"));
  }
  return result;
}

interface NextCall {
  writer: Writer;
  sym: CuSymbol | PropertyAccess;
}

type KtvalsAndNextCall = [Ktvals<JsSrc>, NextCall | null];

async function transpileExpressionWithNextCall(
  ast: Form,
  context: Context,
  isTranspilingCaller = false,
): Promise<KtvalsAndNextCall | TranspileError> {
  async function expandDynamicVar(
    dynVar: DynamicVar,
  ): Promise<TranspileError | KtvalsAndNextCall> {
    const arw = dynVar.call(context);
    const rw = arw instanceof Promise ? await arw : arw;
    if (TranspileError.is(rw)) {
      return rw;
    }
    return [rw, null];
  }

  if (isCuString(ast)) {
    return [[ktvalOther(JSON.stringify(ast))], null];
  }

  if (isReservedSymbol(ast)) {
    const v = ast.valueOf();
    return [[ktvalOther(v == null ? "null" : String(v))], null];
  }

  if (isInteger32(ast) || isFloat64(ast)) {
    return [[ktvalOther(String(ast))], null];
  }

  if (isCuSymbol(ast)) {
    const r = referToWithAssertionIfNeeded(context, ast, isTranspilingCaller);
    if (TranspileError.is(r)) {
      return r;
    }
    if (isDynamicVar(r.writer)) {
      return await expandDynamicVar(r.writer);
    }
    const ktval = transpileSymbolReference(r, ast);
    return [ktval, { writer: r.writer, sym: ast }];
  }

  if (isPropertyAccess(ast)) {
    const r = referToWithAssertionIfNeeded(context, ast, isTranspilingCaller);
    if (TranspileError.is(r)) {
      return r;
    }
    if (isDynamicVar(r.writer)) {
      return await expandDynamicVar(r.writer);
    }
    const ktvals = transpilePropertyAccessReference(r, ast);
    return [ktvals, { writer: r.writer, sym: ast }];
  }

  if (isCuArray(ast)) {
    const elementsSrc = await transpileJoinWithComma(ast, context);
    if (TranspileError.is(elementsSrc)) {
      return elementsSrc;
    }
    return [[ktvalOther("["), ...elementsSrc, ktvalOther("]")], null];
  }
  if (isCuObject(ast)) {
    const kvSrc = await transpileCuObject(ast, context);
    if (TranspileError.is(kvSrc)) {
      return kvSrc;
    }
    return [kvSrc, null];
  }
  if (isList(ast)) {
    const [funcForm, ...args] = ast.values;
    if (funcForm === undefined) {
      return new TranspileError("Invalid function call: empty");
    }

    const funcSrcAndNextCall = await transpileExpressionWithNextCall(
      funcForm,
      context,
      true,
    );
    if (TranspileError.is(funcSrcAndNextCall)) {
      return funcSrcAndNextCall;
    }

    const [funcSrc, nc] = funcSrcAndNextCall;

    if (nc == null) {
      const argsSrc = await transpileJoinWithComma(args, context);
      if (TranspileError.is(argsSrc)) {
        return argsSrc;
      }
      return [
        [
          ktvalOther("("),
          ...funcSrc,
          ktvalOther(")("),
          ...argsSrc,
          ktvalOther(")"),
        ],
        null,
      ];
    }

    const { writer, sym } = nc;
    if (isContextualKeyword(writer)) {
      const symbolAccessSrc = showSymbolAccess(sym);
      return new TranspileError(
        `\`${symbolAccessSrc}\` must be used with \`${writer.companion}\`!`,
      );
    }
    if (isNamespace(writer)) {
      const symbolAccessSrc = showSymbolAccess(sym);
      return new TranspileError(
        `\`${symbolAccessSrc}\` is just a namespace. Doesn't represent a function!`,
      );
    }

    if (
      isVar(writer) ||
      isConst(writer) ||
      isRecursiveConst(writer) ||
      isProvidedConst(writer) ||
      isDynamicVar(writer)
    ) {
      const argsSrc = await transpileJoinWithComma(args, context);
      if (TranspileError.is(argsSrc)) {
        return argsSrc;
      }
      return [[...funcSrc, ktvalOther("("), ...argsSrc, ktvalOther(")")], null];
    }
    if (isMarkedFunctionWithContext(writer)) {
      if (context.transpileState.mode !== "repl") {
        const symbolAccessSrc = showSymbolAccess(sym);
        return new TranspileError(
          `\`${symbolAccessSrc}\` is NOT currently available except in REPL or a macro definition.`,
        );
      }

      const argsSrc = await transpileJoinWithComma(args, context);
      if (TranspileError.is(argsSrc)) {
        return argsSrc;
      }
      return [
        [
          ...funcSrc,
          ktvalOther(`.call(`),
          ktvalContext(),
          ktvalOther(`,`),
          ...argsSrc,
          ktvalOther(")"),
        ],
        null,
      ];
    }

    if (isMarkedDirectWriter(writer)) {
      const src = await writer.call(context, ...args);
      return TranspileError.is(src) ? src : [src, null];
    }

    if (isMacro(writer)) {
      const evalForMacroResult = await evalForMacro(context);
      if (TranspileError.is(evalForMacroResult)) {
        return evalForMacroResult;
      }
      const argValues: unknown[] = [];
      for (const arg of args) {
        const ktvalsForArg = await transpileExpression(arg, context);
        if (TranspileError.is(ktvalsForArg)) {
          return ktvalsForArg;
        }
        // `evalForMacroArgument` returns `any` by definition
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const argJsValue = await evalForMacroArgument(ktvalsForArg, context);
        if (TranspileError.is(argJsValue)) {
          return argJsValue;
        }
        argValues.push(argJsValue);
      }
      // TODO: Pass `context` if the macro function needs it
      // Macro returns any by definition
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const jsValue = await writer.expand(...argValues);
      if (TranspileError.is(jsValue)) {
        return jsValue;
      }
      const form = jsValueToForm(jsValue);
      if (TranspileError.is(form)) {
        return form;
      }
      return await transpileExpressionWithNextCall(form, context);
    }

    throw ExpectNever(writer);
  }
  if (isUnquote(ast)) {
    return new TranspileError("Unquote must be used inside quasiQuote");
  }
  if (isSplice(ast)) {
    return new TranspileError("Splice must be used inside quasiQuote");
  }

  throw ExpectNever(ast);
}

async function transpileCuObject(
  ast: CuObject<Form, Form, Form, Form>,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  let objectContents: Ktvals<JsSrc> = [];
  for (const kv of ast) {
    let kvSrc: Ktvals<JsSrc>;
    if (isKeyValue(kv)) {
      const { key, value } = kv;
      let kSrc: Ktvals<JsSrc>;
      if (isCuSymbol(key)) {
        kSrc = [ktvalOther(key.value)];
      } else {
        const r = await transpileComputedKeyOrExpression(key, context);
        if (TranspileError.is(r)) {
          return r;
        }
        kSrc = r;
      }

      const vSrc = await transpileExpression(value, context);
      if (TranspileError.is(vSrc)) {
        return vSrc;
      }

      kvSrc = [...kSrc, ktvalOther(":"), ...vSrc];
    } else if (isCuSymbol(kv)) {
      const f = referToWithAssertionIfNeeded(context, kv, false);
      if (TranspileError.is(f)) {
        return f;
      }
      if (f.canBeAtPseudoTopLevel) {
        kvSrc = [ktvalOther(kv.value), ktvalOther(":"), ktvalRefer(kv.value)];
      } else {
        kvSrc = [ktvalOther(kv.value)];
      }
    } else if (isUnquote(kv)) {
      return new TranspileError("Unquote must be used inside quasiQuote");
    } else {
      throw ExpectNever(kv);
    }
    objectContents = [...objectContents, ...kvSrc, ktvalOther(",")];
  }
  return [ktvalOther("{"), ...objectContents, ktvalOther("}")];
}

function referToWithAssertionIfNeeded(
  context: Context,
  symLike: CuSymbol | PropertyAccess,
  isTranspilingCaller: boolean,
): ContextF.WriterWithIsAtTopLevel | TranspileError {
  const r = ContextF.referTo(context, symLike);
  if (isTranspilingCaller) {
    return r;
  }

  if (TranspileError.is(r)) {
    return r;
  }
  if (isMarkedDirectWriter(r.writer)) {
    const symbolFullName = showSymbolAccess(symLike);
    return new TranspileError(
      `A direct writer \`${symbolFullName}\` cannot be assigned to a variable or passed as an argument.`,
    );
  }
  if (isNamespace(r.writer)) {
    const symbolFullName = showSymbolAccess(symLike);
    return new TranspileError(
      `A namespace \`${symbolFullName}\` cannot be assigned to a variable or passed as an argument.`,
    );
  }
  if (isMacro(r.writer)) {
    const symbolFullName = showSymbolAccess(symLike);
    return new TranspileError(
      `A macro \`${symbolFullName}\` cannot be assigned to a variable or passed as an argument.`,
    );
  }

  return r;
}

export async function transpileComputedKeyOrExpression(
  key: ComputedKey<Form> | Form,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  if (isComputedKey(key)) {
    const r = await transpileExpression(key.value, context);
    if (TranspileError.is(r)) {
      return r;
    }
    return [ktvalOther("["), ...r, ktvalOther("]")];
  }

  return await transpileExpression(key, context);
}

export async function transpileBlock(
  forms: Block,
  context: Context,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<Ktvals<JsSrc> | TranspileError> {
  const resultKtvalsOffset = await transpileBlockCore(
    forms,
    context,
    extraOptions,
  );

  if (TranspileError.is(resultKtvalsOffset)) {
    return resultKtvalsOffset;
  }

  const src = context.transpileState.transpiledSrc;
  if (src.length > resultKtvalsOffset) {
    const lastExpression = src.slice(resultKtvalsOffset);
    return [
      ...src.slice(0, resultKtvalsOffset),
      ktvalOther("export default "),
      ...lastExpression,
    ];
  }

  return src;
}

export async function transpileBlockCore(
  forms: Block,
  context: Context,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<number | TranspileError> {
  const lastIndex = forms.length - 1;

  for (let i = 0; i < lastIndex; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const s = await transpileExpression(forms[i]!, context);
    if (TranspileError.is(s)) {
      return s;
    }
    context.transpileState.transpiledSrc.push(...s, ktvalOther(";\n"));
  }

  const lastForm = forms[lastIndex];
  if (lastForm === undefined) {
    return 0;
  }

  const last = await transpileExpression(lastForm, context);
  if (TranspileError.is(last)) {
    return last;
  }

  const resultKtvalsOffset = context.transpileState.transpiledSrc.length;
  const stmt = asStatement(context, lastForm);
  if (TranspileError.is(stmt)) {
    return stmt;
  }
  const lastIsExpression = stmt === undefined;
  if (lastIsExpression && extraOptions.mayHaveResult) {
    context.transpileState.transpiledSrc.push(...last, ktvalOther(";\n"));
    return resultKtvalsOffset;
  }
  context.transpileState.transpiledSrc.push(...last);

  return context.transpileState.transpiledSrc.length;
}

export async function transpileString(
  input: ReaderInput,
  context: Context<TranspileModule>,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const forms = readBlock(input);
  if (isParseError(forms)) {
    return TranspileError.wrap(forms);
  }
  const mod = await transpileBlock(forms, context);
  if (mod instanceof Error) {
    return mod;
  }
  clearTranspiledSrc(context.transpileState);
  return mod;
}

export async function transpileJoinWithComma(
  xs: Form[],
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const result: Ktvals<JsSrc> = [];
  const lastI = xs.length - 1;
  for (const [i, x] of xs.entries()) {
    const stmt = asStatement(context, x);
    if (TranspileError.is(stmt)) {
      return stmt;
    }
    if (stmt !== undefined) {
      return new TranspileError(
        `An expression was expected, but a statement ${formatForError(x)} was found!`,
      );
    }
    const r = await transpileExpression(x, context);
    if (TranspileError.is(r)) {
      return r;
    }
    if (i === lastI) {
      result.push(...r);
    } else {
      result.push(...r, ktvalOther(","));
    }
  }
  return result;
}

export function transpilePropertyAccessReference(
  r: ContextF.WriterWithIsAtTopLevel,
  ast: PropertyAccess,
): Ktvals<JsSrc> {
  if (r.canBeAtPseudoTopLevel) {
    const [id0, ...ids] = ast.value;
    return [ktvalRefer(id0), ktvalOther(`.${ids.join(".")}`)];
  } else {
    return [ktvalOther(ast.value.join("."))];
  }
}

export function transpileSymbolReference(
  r: ContextF.WriterWithIsAtTopLevel,
  ast: CuSymbol,
): Ktvals<JsSrc> {
  return r.canBeAtPseudoTopLevel
    ? [ktvalRefer(ast.value)]
    : [ktvalOther(ast.value)];
}
