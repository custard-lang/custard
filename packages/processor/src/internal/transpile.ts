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
  isMarkedFunctionWithEnv,
  isNamespace,
  isProvidedConst,
  type Writer,
  isDynamicVar,
  jsValueToForm,
  type Ktvals,
  ktvalOther,
  ktvalRefer,
  type TranspileModule,
} from "../internal/types.js";
import { CU_ENV } from "./cu-env.js";
import { type Env } from "./types.js";
import * as EnvF from "./env.js";
import { readBlock } from "../reader.js";
import { ParseError } from "../grammar.js";
import { isStatement } from "./call.js";
import { evalForMacro } from "./eval/core.js";
import { clearTranspiledSrc } from "./transpile-state.js";

export async function transpileExpression(
  ast: Form,
  env: Env,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const r = await transpileExpressionWithNextCall(ast, env);
  if (TranspileError.is(r)) {
    return r;
  }
  const [ktvals, _] = r;
  return ktvals;
}

export async function transpileStatements(
  asts: Form[],
  env: Env,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const result: Ktvals<JsSrc> = [];
  for (const ast of asts) {
    const r = await transpileExpression(ast, env);
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
  env: Env,
): Promise<KtvalsAndNextCall | TranspileError> {
  async function expandDynamicVar(
    dynVar: DynamicVar,
  ): Promise<TranspileError | KtvalsAndNextCall> {
    const arw = dynVar.call(env);
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
    const r = EnvF.referTo(env, ast);
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
    const r = EnvF.referTo(env, ast);
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
    const elementsSrc = await transpileJoinWithComma(ast, env);
    if (TranspileError.is(elementsSrc)) {
      return elementsSrc;
    }
    return [[ktvalOther("["), ...elementsSrc, ktvalOther("]")], null];
  }
  if (isCuObject(ast)) {
    const kvSrc = await transpileCuObject(ast, env);
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
      env,
    );
    if (TranspileError.is(funcSrcAndNextCall)) {
      return funcSrcAndNextCall;
    }

    const [funcSrc, nc] = funcSrcAndNextCall;

    if (nc == null) {
      const argsSrc = await transpileJoinWithComma(args, env);
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
      const argsSrc = await transpileJoinWithComma(args, env);
      if (TranspileError.is(argsSrc)) {
        return argsSrc;
      }
      return [[...funcSrc, ktvalOther("("), ...argsSrc, ktvalOther(")")], null];
    }
    if (isMarkedFunctionWithEnv(writer)) {
      if (env.transpileState.mode !== "repl") {
        const symbolAccessSrc = showSymbolAccess(sym);
        return new TranspileError(
          `\`${symbolAccessSrc}\` is NOT currently available except in REPL or a macro definition.`,
        );
      }

      const argsSrc = await transpileJoinWithComma(args, env);
      if (TranspileError.is(argsSrc)) {
        return argsSrc;
      }
      return [
        [
          ...funcSrc,
          ktvalOther(`.call(${CU_ENV},`),
          ...argsSrc,
          ktvalOther(")"),
        ],
        null,
      ];
    }

    if (isMarkedDirectWriter(writer)) {
      const src = await writer.call(env, ...args);
      return TranspileError.is(src) ? src : [src, null];
    }

    if (isMacro(writer)) {
      const evalForMacroResult = await evalForMacro(env);
      if (TranspileError.is(evalForMacroResult)) {
        return evalForMacroResult;
      }
      const jsValue = await writer.expand(env, ...args);
      if (TranspileError.is(jsValue)) {
        return jsValue;
      }
      const form = jsValueToForm(jsValue);
      if (TranspileError.is(form)) {
        return form;
      }
      return await transpileExpressionWithNextCall(form, env);
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
  env: Env,
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
        const r = await transpileComputedKeyOrExpression(key, env);
        if (TranspileError.is(r)) {
          return r;
        }
        kSrc = r;
      }

      const vSrc = await transpileExpression(value, env);
      if (TranspileError.is(vSrc)) {
        return vSrc;
      }

      kvSrc = [...kSrc, ktvalOther(":"), ...vSrc];
    } else if (isCuSymbol(kv)) {
      const f = EnvF.referTo(env, kv);
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
  env: Env,
): Promise<Ktvals<JsSrc> | TranspileError> {
  if (isComputedKey(key)) {
    const r = await transpileExpression(key.value, env);
    if (TranspileError.is(r)) {
      return r;
    }
    return [ktvalOther("["), ...r, ktvalOther("]")];
  }

  return await transpileExpression(key, env);
}

export async function transpileBlock(
  forms: Block,
  env: Env,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<Ktvals<JsSrc> | TranspileError> {
  const resultKtvalsOffset = await transpileBlockCore(forms, env, extraOptions);

  if (TranspileError.is(resultKtvalsOffset)) {
    return resultKtvalsOffset;
  }

  const src = env.transpileState.transpiledSrc;
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
  env: Env,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<number | TranspileError> {
  const lastIndex = forms.length - 1;

  for (let i = 0; i < lastIndex; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const s = await transpileExpression(forms[i]!, env);
    if (s instanceof Error) {
      return s;
    }
    env.transpileState.transpiledSrc.push(...s, ktvalOther(";\n"));
  }

  const lastForm = forms[lastIndex];
  if (lastForm === undefined) {
    return 0;
  }

  const last = await transpileExpression(lastForm, env);
  if (last instanceof Error) {
    return last;
  }

  const resultKtvalsOffset = env.transpileState.transpiledSrc.length;
  const lastIsExpression = !isStatement(env, lastForm);
  if (lastIsExpression && extraOptions.mayHaveResult) {
    env.transpileState.transpiledSrc.push(...last, ktvalOther(";\n"));
    return resultKtvalsOffset;
  }
  env.transpileState.transpiledSrc.push(...last);

  return env.transpileState.transpiledSrc.length;
}

export async function transpileString(
  input: ReaderInput,
  env: Env<TranspileModule>,
): Promise<Ktvals<JsSrc> | Error> {
  const forms = readBlock(input);
  if (ParseError.is(forms)) {
    return forms;
  }
  const mod = await transpileBlock(forms, env);
  if (mod instanceof Error) {
    return mod;
  }
  clearTranspiledSrc(env.transpileState);
  return mod;
}

// TODO: accept only expression form (not a statement)
export async function transpileJoinWithComma(
  xs: Form[],
  env: Env,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const result: Ktvals<JsSrc> = [];
  const lastI = xs.length - 1;
  for (const [i, x] of xs.entries()) {
    const r = await transpileExpression(x, env);
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
