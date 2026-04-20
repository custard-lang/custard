import { ExpectNever } from "../util/error.js";

import {
  type Block,
  type ComputedKey,
  type CuObject,
  CuString,
  type CuSymbol,
  Float64,
  type Form,
  Integer32,
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
  ReservedSymbol,
  showSymbolAccess,
  TranspileError,
  List,
} from "../types.js";
import {
  type Context,
  isContextualKeyword,
  isDynamicVar,
  isMacro,
  isMarkedDirectWriter,
  isMarkedFunctionWithContext,
  isNamespace,
  isProvidedConst,
  isRecursiveConst,
  isVar,
  ktvalContext,
  ktvalOther,
  ktvalRefer,
  type Ktvals,
  type TranspileModule,
  type Writer,
  WriterKind,
  WriterKindProvidedConst,
  WriterKindDynamicVar,
  WriterKindVar,
  WriterKindConst,
  WriterKindRecursiveConst,
  functionIdOfCall,
  Macro,
  isMarkedDirectStatementWriter,
} from "./types.js";
import * as ContextF from "./context.js";
import { readBlock } from "../reader.js";
import { isParseError } from "../grammar.js";
import { asCall } from "./call.js";
import { evalForMacro } from "./eval/core.js";
import { clearTranspiledSrc } from "./transpile-state.js";

export const transpileExpression: (
  form: Form,
  context: Context,
) => Promise<Ktvals<JsSrc> | TranspileError> = transpileExpressionU;

export async function transpileExpressionU(
  form: unknown,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = await transpileStatementWithWriterU(form, context);
  if (TranspileError.is(r)) {
    return r;
  }
  const [ktvals, cw] = r;
  if (cw !== null && isMarkedDirectStatementWriter(cw.writer)) {
    const symbolAccessSrc = showSymbolAccess(cw.sym);
    return new TranspileError(
      `\`${symbolAccessSrc}\` cannot be used in an expression position because it's a statement!`,
    );
  }
  return ktvals;
}

export const transpileStatement: (
  form: Form,
  context: Context,
) => Promise<Ktvals<JsSrc> | TranspileError> = transpileStatementU;

export async function transpileStatementU(
  form: unknown,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = await transpileStatementWithWriterU(form, context);
  if (TranspileError.is(r)) {
    return r;
  }
  return r[0];
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

  let lastIsExpression = false;
  let resultKtvalsOffset = 0;
  function rememberLastIsExpression(i: number, r: KtvalsAndWriter): void {
    if (i !== lastIndex) {
      return;
    }
    const [, cw] = r;
    lastIsExpression =
      cw === null ||
      !isMarkedDirectWriter(cw.writer) ||
      !cw.writer.kind.statement;
  }

  for (const [i, form] of forms.entries()) {
    if (isSplice(form)) {
      const spliced = await transpileStatementSpliceWithWriterU(
        form.value,
        context,
      );
      if (TranspileError.is(spliced)) {
        return spliced;
      }
      for (const [ktvals, _] of spliced) {
        resultKtvalsOffset = context.transpileState.transpiledSrc.length;
        context.transpileState.transpiledSrc.push(...ktvals, ktvalOther(";\n"));
      }
      if (spliced.length > 0) {
        // This should always be safe because we check the length above
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        rememberLastIsExpression(i, spliced[spliced.length - 1]!);
      }
      continue;
    }
    const s = await transpileStatementWithWriterU(form, context);
    if (TranspileError.is(s)) {
      return s;
    }
    resultKtvalsOffset = context.transpileState.transpiledSrc.length;
    if (i === lastIndex) {
      context.transpileState.transpiledSrc.push(...s[0]);
    } else {
      context.transpileState.transpiledSrc.push(...s[0], ktvalOther(";\n"));
    }
    rememberLastIsExpression(i, s);
  }

  // False positive
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (lastIsExpression && extraOptions.mayHaveResult) {
    context.transpileState.transpiledSrc.push(ktvalOther(";\n"));
    return resultKtvalsOffset;
  }

  return context.transpileState.transpiledSrc.length;
}

export async function transpileToString(
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

export const transpileExpressionsJoinWithComma: (
  forms: Form[],
  context: Context,
) => Promise<Ktvals<JsSrc> | TranspileError> =
  transpileExpressionsJoinWithCommaU;

export async function transpileExpressionsJoinWithCommaU(
  forms: unknown[],
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const srcs = await transpileExpressionSequence(forms, context);
  if (TranspileError.is(srcs)) {
    return srcs;
  }
  return joinWith(srcs, ",");
}

export async function transpileStatementsJoinWithSemicolonU(
  forms: unknown[],
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const srcs = await transpileStatementSequence(forms, context);
  if (TranspileError.is(srcs)) {
    return srcs;
  }
  return joinWith(srcs, ";\n");
}

async function transpileExpressionSequence(
  forms: unknown[],
  context: Context,
): Promise<Array<Ktvals<JsSrc>> | TranspileError> {
  const result: Array<Ktvals<JsSrc>> = [];
  for (const form of forms) {
    if (isSplice(form)) {
      const spliced = await transpileExpressionSplice(form.value, context);
      if (TranspileError.is(spliced)) {
        return spliced;
      }
      result.push(...spliced);
      continue;
    }
    const s = await transpileExpressionU(form, context);
    if (TranspileError.is(s)) {
      return s;
    }
    result.push(s);
  }
  return result;
}

async function transpileStatementSequence(
  forms: unknown[],
  context: Context,
): Promise<Array<Ktvals<JsSrc>> | TranspileError> {
  const result: Array<Ktvals<JsSrc>> = [];
  for (const form of forms) {
    if (isSplice(form)) {
      const spliced = await transpileStatementSpliceWithWriterU(
        form.value,
        context,
      );
      if (TranspileError.is(spliced)) {
        return spliced;
      }
      result.push(...spliced.map(([ktvals]) => ktvals));
      continue;
    }
    const s = await transpileStatementWithWriterU(form, context);
    if (TranspileError.is(s)) {
      return s;
    }
    result.push(s[0]);
  }
  return result;
}

export async function transpileExpressionsJoinWithCommaNoSpliceU(
  forms: unknown[],
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const srcs: Array<Ktvals<JsSrc>> = [];
  for (const form of forms) {
    const r = await transpileExpressionU(form, context);
    if (TranspileError.is(r)) {
      return r;
    }
    srcs.push(r);
  }
  return joinWith(srcs, ",");
}

function joinWith(
  srcs: Array<Ktvals<JsSrc>>,
  s: string,
): Ktvals<JsSrc> | TranspileError {
  if (srcs.length === 0) {
    return [];
  }
  const result: Ktvals<JsSrc> = [];
  const lastI = srcs.length - 1;
  for (let i = 0; i < lastI; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    result.push(...srcs[i]!, ktvalOther(s));
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  result.push(...srcs[lastI]!);
  return result;
}

interface CallingOrCalledWriter {
  writer: Writer;
  sym: CuSymbol | PropertyAccess;
}

type KtvalsAndWriter = [Ktvals<JsSrc>, CallingOrCalledWriter | null];

async function transpileStatementSpliceWithWriterU(
  form: unknown,
  context: Context,
): Promise<KtvalsAndWriter[] | TranspileError> {
  const call = asCall(form);
  if (call === undefined) {
    return new TranspileError(
      "Splice in statement position must be a macro call!",
    );
  }
  const writer = ContextF.find(context, functionIdOfCall(call));
  if (TranspileError.is(writer)) {
    return writer;
  }
  if (!isMacro(writer)) {
    return new TranspileError(
      "Splice in statement position must be a macro call!",
    );
  }

  const macroResult = await expandMacro(writer, call.values.slice(1), context);
  if (TranspileError.is(macroResult)) {
    return macroResult;
  }
  if (isList(macroResult) || Array.isArray(macroResult)) {
    const result: KtvalsAndWriter[] = [];
    for (const form of macroResult) {
      const r = await transpileStatementWithWriterU(form, context);
      if (TranspileError.is(r)) {
        return r;
      }
      result.push(r);
    }
    return result;
  }
  const r = await transpileStatementWithWriterU(macroResult, context);
  if (TranspileError.is(r)) {
    return r;
  }
  return [r];
}

async function transpileExpressionSplice(
  form: unknown,
  context: Context,
): Promise<Iterable<Ktvals<JsSrc>> | TranspileError> {
  const call = asCall(form);
  if (call !== undefined) {
    const writer = ContextF.find(context, functionIdOfCall(call));
    if (TranspileError.is(writer)) {
      return writer;
    }
    if (isMacro(writer)) {
      const macroResult = await expandMacro(
        writer,
        call.values.slice(1),
        context,
      );
      if (TranspileError.is(macroResult)) {
        return macroResult;
      }
      if (isList(macroResult) || Array.isArray(macroResult)) {
        const result: Array<Ktvals<JsSrc>> = [];
        for (const form of macroResult) {
          const r = await transpileExpressionU(form, context);
          if (TranspileError.is(r)) {
            return r;
          }
          result.push(r);
        }
        return result;
      }
      const r = await transpileExpressionU(macroResult, context);
      if (TranspileError.is(r)) {
        return r;
      }
      return [r];
    }
  }
  const r = await transpileExpressionU(form, context);
  if (TranspileError.is(r)) {
    return r;
  }
  return [[ktvalOther("..."), ...r]];
}

export async function transpileStatementWithWriterU(
  form: unknown,
  context: Context,
): Promise<KtvalsAndWriter | TranspileError> {
  if (isList(form)) {
    return await transpileCallStatementWithWriter(form, context);
  }

  if (isCuArray(form) || Array.isArray(form)) {
    const elementsSrc = await transpileExpressionsJoinWithCommaU(form, context);
    if (TranspileError.is(elementsSrc)) {
      return elementsSrc;
    }
    return [[ktvalOther("["), ...elementsSrc, ktvalOther("]")], null];
  }

  // Generic object can be too ambiguous to treat as an object literal.
  if (isCuObject(form)) {
    return withNoCallingWriter(await transpileCuObject(form, context));
  }

  // TODO: In statements, we don't usually use AtomLike forms. Warn here.
  if (isCuString(form) || typeof form === "string") {
    return withNoCallingWriter(transpileString(form));
  }
  if (form == null) {
    return withNoCallingWriter([ktvalOther("null")]);
  }
  if (isReservedSymbol(form) || typeof form === "boolean") {
    return withNoCallingWriter(transpileReservedSymbol(form));
  }
  if (isInteger32(form) || isFloat64(form) || typeof form === "number") {
    return withNoCallingWriter(transpileNumber(form));
  }
  if (isCuSymbol(form)) {
    return withNoCallingWriter(await transpileSymbolInNonCall(form, context));
  }
  if (isPropertyAccess(form)) {
    return withNoCallingWriter(
      await transpilePropertyAccessInNonCall(form, context),
    );
  }

  if (isUnquote(form)) {
    return new TranspileError("Unquote must be used inside quasiQuote");
  }

  if (isSplice(form)) {
    return new TranspileError(
      "Splice must be used inside quasiQuote, a collection literal (array, object or list), or a statement block!",
    );
  }

  return TranspileError.macroReturnedInvalidValue(form);
}

async function transpileCalleeExpressionWithWriter(
  form: unknown,
  context: Context,
): Promise<KtvalsAndWriter | TranspileError> {
  if (isCuSymbol(form)) {
    return await transpileSymbolWithCallingWriter(form, context);
  }
  if (isPropertyAccess(form)) {
    return await transpilePropertyAccessWithCallingWriter(form, context);
  }
  if (isList(form)) {
    return withNoCallingWriter(await transpileCallExpression(form, context));
  }
  if (isCuArray(form) || Array.isArray(form)) {
    return new TranspileError(
      "Array literal cannot be used in a function calling position!",
    );
  }
  // Generic object can be too ambiguous to treat as an object literal.
  if (isCuObject(form)) {
    return new TranspileError(
      "Object literal cannot be used in a function calling position!",
    );
  }
  if (isCuString(form) || typeof form === "string") {
    return new TranspileError(
      "String literal cannot be used in a function calling position!",
    );
  }
  if (isReservedSymbol(form) || form == null || typeof form === "boolean") {
    return new TranspileError(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `\`${form}\` cannot be used in a function calling position!`,
    );
  }
  if (isFloat64(form) || typeof form === "number") {
    return new TranspileError(
      "Float literal cannot be used in a function calling position!",
    );
  }
  if (isInteger32(form)) {
    return new TranspileError(
      "Integer literal cannot be used in a function calling position!",
    );
  }
  if (isSplice(form)) {
    return new TranspileError(
      "Splice cannot be used in a function calling position!",
    );
  }
  if (isUnquote(form)) {
    return new TranspileError("Unquote must be used inside quasiQuote");
  }

  return TranspileError.macroReturnedInvalidValue(form);
}

async function transpileCallExpression(
  form: List<unknown>,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = await transpileCallExpressionWithWriter(form, context);
  if (TranspileError.is(r)) {
    return r;
  }

  return r[0];
}

async function transpileCallExpressionWithWriter(
  form: List<unknown>,
  context: Context,
): Promise<KtvalsAndWriter | TranspileError> {
  const r = await transpileCallStatementWithWriter(form, context);
  if (TranspileError.is(r)) {
    return r;
  }
  const [ktvals, cw] = r;
  if (cw === null) {
    return [ktvals, cw];
  }
  const { writer } = cw;
  if (isMarkedDirectStatementWriter(writer)) {
    return new TranspileError(
      `\`${showSymbolAccess(cw.sym)}\` cannot be used in an expression calling position because it's a direct writer for statements!`,
    );
  }
  return [ktvals, cw];
}

async function transpileCallStatementWithWriter(
  form: List<unknown>,
  context: Context,
): Promise<KtvalsAndWriter | TranspileError> {
  const [funcForm, ...args] = form.values;
  if (funcForm === undefined) {
    return new TranspileError("Invalid function call: empty");
  }

  const funcSrcAndCallingWriter = await transpileCalleeExpressionWithWriter(
    funcForm,
    context,
  );

  if (TranspileError.is(funcSrcAndCallingWriter)) {
    return funcSrcAndCallingWriter;
  }

  const [funcSrc, cw] = funcSrcAndCallingWriter;
  if (cw === null) {
    const argsSrc = await transpileExpressionsJoinWithCommaU(args, context);
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

  const { writer, sym } = cw;
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
    const argsSrc = await transpileExpressionsJoinWithCommaU(args, context);
    if (TranspileError.is(argsSrc)) {
      return argsSrc;
    }
    return [
      [...funcSrc, ktvalOther("("), ...argsSrc, ktvalOther(")")],
      { sym, writer },
    ];
  }
  if (isMarkedFunctionWithContext(writer)) {
    if (context.transpileState.mode !== "repl") {
      const symbolAccessSrc = showSymbolAccess(sym);
      return new TranspileError(
        `\`${symbolAccessSrc}\` is NOT currently available except in REPL or a macro definition.`,
      );
    }

    const argsSrc = await transpileExpressionsJoinWithCommaU(args, context);
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
      { sym, writer },
    ];
  }

  const splicedArgs = await processMacroSplices(args, context);
  if (TranspileError.is(splicedArgs)) {
    return splicedArgs;
  }
  if (isMarkedDirectWriter(writer)) {
    const src = await writer.call(context, ...splicedArgs);
    return TranspileError.is(src) ? src : [src, { sym, writer }];
  }

  if (isMacro(writer)) {
    const expandedForm = await expandMacro(writer, splicedArgs, context);
    return TranspileError.is(expandedForm)
      ? expandedForm
      : await transpileStatementWithWriterU(expandedForm, context);
  }
  throw ExpectNever(writer);
}

async function processMacroSplices(
  forms: unknown[],
  context: Context,
): Promise<unknown[] | TranspileError> {
  const result: unknown[] = [];
  for (const form of forms) {
    if (isSplice(form)) {
      const splicedForms = await processMacroSplice(form.value, context);
      if (TranspileError.is(splicedForms)) {
        return splicedForms;
      }
      result.push(...splicedForms);
      continue;
    }
    result.push(form);
  }
  return result;
}

async function processMacroSplice(
  form: unknown,
  context: Context,
): Promise<unknown[] | TranspileError> {
  const call = asCall(form);
  if (call !== undefined) {
    const writer = ContextF.find(context, functionIdOfCall(call));
    if (TranspileError.is(writer)) {
      return writer;
    }
    if (isMacro(writer)) {
      const macroResult = await expandMacro(
        writer,
        call.values.slice(1),
        context,
      );
      if (TranspileError.is(macroResult)) {
        return macroResult;
      }
      if (Array.isArray(macroResult)) {
        return macroResult as unknown[];
      }
      if (isList(macroResult)) {
        return macroResult.values;
      }
      return [macroResult];
    }
  }
  return new TranspileError(
    "Splice in a macro argument must be a macro call that returns forms to be spliced!",
  );
}

async function expandMacro(
  macro: Macro,
  args: unknown[],
  context: Context,
): Promise<unknown | TranspileError> {
  const evalForMacroResult = await evalForMacro(context);
  if (TranspileError.is(evalForMacroResult)) {
    return evalForMacroResult;
  }
  // TODO: Pass `context` if the macro function needs it
  return await macro.expand(...args);
}

function transpileString(ast: CuString | string): Ktvals<JsSrc> {
  return [ktvalOther(JSON.stringify(ast))];
}

function transpileReservedSymbol(ast: ReservedSymbol | boolean): Ktvals<JsSrc> {
  const v = ast.valueOf();
  return [ktvalOther(v == null ? "null" : String(v))];
}

function transpileNumber(ast: Integer32 | Float64 | number): Ktvals<JsSrc> {
  return [ktvalOther(String(ast))];
}

async function transpileSymbolInNonCall(
  ast: CuSymbol,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = ContextF.referToWithAssertion(
    context,
    ast,
    expectedWriterKindsInNonCall,
  );
  if (TranspileError.is(r)) {
    return r;
  }
  if (isDynamicVar(r.writer)) {
    return await r.writer.call(context);
  }
  return transpileSymbolReference(r, ast);
}

async function transpilePropertyAccessInNonCall(
  ast: PropertyAccess,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = ContextF.referToWithAssertion(
    context,
    ast,
    expectedWriterKindsInNonCall,
  );
  if (TranspileError.is(r)) {
    return r;
  }
  if (isDynamicVar(r.writer)) {
    return await r.writer.call(context);
  }
  return transpilePropertyAccessReference(r, ast);
}

const expectedWriterKindsInNonCall: WriterKind[] = [
  WriterKindVar,
  WriterKindConst,
  WriterKindRecursiveConst,
  WriterKindProvidedConst,
  WriterKindDynamicVar,
];

async function transpileSymbolWithCallingWriter(
  form: CuSymbol,
  context: Context,
): Promise<KtvalsAndWriter | TranspileError> {
  const r = ContextF.referTo(context, form);
  if (TranspileError.is(r)) {
    return r;
  }
  if (isDynamicVar(r.writer)) {
    return withNoCallingWriter(await r.writer.call(context));
  }
  const ktval = transpileSymbolReference(r, form);
  return [ktval, { writer: r.writer, sym: form }];
}

async function transpilePropertyAccessWithCallingWriter(
  form: PropertyAccess,
  context: Context,
): Promise<KtvalsAndWriter | TranspileError> {
  const r = ContextF.referTo(context, form);
  if (TranspileError.is(r)) {
    return r;
  }
  if (isDynamicVar(r.writer)) {
    return withNoCallingWriter(await r.writer.call(context));
  }
  const ktvals = transpilePropertyAccessReference(r, form);
  return [ktvals, { writer: r.writer, sym: form }];
}

function withNoCallingWriter(
  s: Ktvals<JsSrc> | TranspileError,
): KtvalsAndWriter | TranspileError {
  if (TranspileError.is(s)) {
    return s;
  }
  return [s, null];
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

async function transpileCuObject(
  ast: CuObject<unknown>,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const objectContents: Ktvals<JsSrc> = [];
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

      const vSrc = await transpileExpressionU(value, context);
      if (TranspileError.is(vSrc)) {
        return vSrc;
      }

      kvSrc = [...kSrc, ktvalOther(":"), ...vSrc];
    } else if (isCuSymbol(kv)) {
      const f = ContextF.referToWithAssertion(
        context,
        kv,
        expectedWriterKindsInNonCall,
      );
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
    } else if (isSplice(kv)) {
      // TODO: Support splicing key-value pairs returned by macros
      const spliceValue = kv.value;
      const r = await transpileExpressionU(spliceValue, context);
      if (TranspileError.is(r)) {
        return r;
      }
      kvSrc = [ktvalOther("...("), ...r, ktvalOther(")")];
    } else {
      throw ExpectNever(kv);
    }
    objectContents.push(...kvSrc, ktvalOther(","));
  }
  return [ktvalOther("{"), ...objectContents, ktvalOther("}")];
}

export async function transpileComputedKeyOrExpression(
  key: ComputedKey<unknown> | unknown,
  context: Context,
): Promise<Ktvals<JsSrc> | TranspileError> {
  if (isComputedKey(key)) {
    const r = await transpileExpressionU(key.value, context);
    if (TranspileError.is(r)) {
      return r;
    }
    return [ktvalOther("["), ...r, ktvalOther("]")];
  }

  return await transpileExpressionU(key, context);
}
