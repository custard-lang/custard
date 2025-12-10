import { ExpectNever } from "../util/error.js";

import {
  type Block,
  type CuSymbol,
  type Form,
  isCuSymbol,
  isKeyValue,
  isList,
  isPropertyAccess,
  type JsSrc,
  type CuObject,
  type PropertyAccess,
  type ReaderInput,
  showSymbolAccess,
  TranspileError,
  isCuString,
  isReservedSymbol,
  isInteger32,
  isFloat64,
  isCuArray,
  isCuObject,
  isUnquote,
  isSplice,
  type ComputedKey,
  isComputedKey,
} from "../types.js";
import {
  canBePseudoTopLevelReferenced,
  type DynamicVar,
  isMacro,
  isContextualKeyword,
  isMarkedDirectWriter,
  isMarkedFunctionWithContext,
  isNamespace,
  isProvidedConst,
  type Writer,
  isDynamicVar,
  jsValueToForm,
  type Ktvals,
  ktvalOther,
  ktvalRefer,
  type TranspileModule,
  ktvalContext,
  formatForError,
} from "./types.js";
import { type Context } from "./types.js";
import * as ContextF from "./context.js";
import { readBlock } from "../reader.js";
import { isParseError } from "../grammar.js";
import { isStatement } from "./call.js";
import { evalForMacro } from "./eval/core.js";
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
    const r = ContextF.referTo(context, ast);
    if (TranspileError.is(r)) {
      return r;
    }
    if (isDynamicVar(r.writer)) {
      return await expandDynamicVar(r.writer);
    }
    const ktval = r.canBeAtPseudoTopLevel
      ? ktvalRefer(ast.value)
      : ktvalOther(ast.value);
    return [[ktval], { writer: r.writer, sym: ast }];
  }

  if (isPropertyAccess(ast)) {
    // TODO: Properly Access inside Namespace
    const r = ContextF.referTo(context, ast);
    if (TranspileError.is(r)) {
      return r;
    }
    if (isDynamicVar(r.writer)) {
      return await expandDynamicVar(r.writer);
    }

    let ktvals: Ktvals<JsSrc>;
    if (r.canBeAtPseudoTopLevel) {
      const [id0, ...ids] = ast.value;
      ktvals = [ktvalRefer(id0), ktvalOther(`.${ids.join(".")}`)];
    } else {
      ktvals = [ktvalOther(ast.value.join("."))];
    }
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
      canBePseudoTopLevelReferenced(writer) ||
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
      // Macro returns any by definition
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const jsValue = await writer.expand(context, ...args);
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
      const f = ContextF.referTo(context, kv);
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
  const lastIsExpression = !isStatement(context, lastForm);
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
    if (isStatement(context, x)) {
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
