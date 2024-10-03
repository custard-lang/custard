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
} from "../internal/types.js";
import {
  CU_ENV,
  pseudoTopLevelReference,
  pseudoTopLevelReferenceToPropertyAccess,
} from "./cu-env.js";
import { type Env } from "./types.js";
import * as EnvF from "./env.js";
import { readBlock } from "../reader.js";
import { ParseError } from "../grammar.js";
import { isStatement } from "./call.js";

export async function transpileExpression(
  ast: Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  const r = await transpileExpressionWithNextCall(ast, env);
  if (TranspileError.is(r)) {
    return r;
  }
  return r[0];
}

interface NextCall {
  writer: Writer;
  sym: CuSymbol | PropertyAccess;
}

type JsSrcAndNextCall = [JsSrc, NextCall | null];

async function transpileExpressionWithNextCall(
  ast: Form,
  env: Env,
): Promise<JsSrcAndNextCall | TranspileError> {
  async function expandDynamicVar(
    dynVar: DynamicVar,
  ): Promise<TranspileError | JsSrcAndNextCall> {
    const arw = dynVar.call(env);
    const rw = arw instanceof Promise ? await arw : arw;
    if (TranspileError.is(rw)) {
      return rw;
    }
    return [rw, null];
  }

  if (isCuString(ast)) {
    return [JSON.stringify(ast), null];
  }
  if (isReservedSymbol(ast)) {
    const v = ast.valueOf();
    return [v == null ? "null" : String(v), null];
  }
  if (isInteger32(ast) || isFloat64(ast)) {
    return [String(ast), null];
  }
  if (isCuSymbol(ast)) {
    const r = EnvF.referTo(env, ast);
    if (TranspileError.is(r)) {
      return r;
    }
    if (isDynamicVar(r.writer)) {
      return await expandDynamicVar(r.writer);
    }
    if (EnvF.writerIsAtReplTopLevel(env, r)) {
      return [
        pseudoTopLevelReference(ast.value),
        { writer: r.writer, sym: ast },
      ];
    }
    return [ast.value, { writer: r.writer, sym: ast }];
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
    if (EnvF.writerIsAtReplTopLevel(env, r)) {
      return [
        pseudoTopLevelReferenceToPropertyAccess(ast),
        { writer: r.writer, sym: ast },
      ];
    }
    return [ast.value.join("."), { writer: r.writer, sym: ast }];
  }
  if (isCuArray(ast)) {
    const elementsSrc = await transpileJoinWithComma(ast, env);
    if (TranspileError.is(elementsSrc)) {
      return elementsSrc;
    }
    return [`[${elementsSrc}]`, null];
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
      return [`(${funcSrc})(${argsSrc})`, null];
    }

    const { writer, sym } = nc;
    if (isContextualKeyword(writer)) {
      const symbolAcessSrc = showSymbolAccess(sym);
      return new TranspileError(
        `\`${symbolAcessSrc}\` must be used with \`${writer.companion}\`!`,
      );
    }
    if (isNamespace(writer)) {
      const symbolAcessSrc = showSymbolAccess(sym);
      return new TranspileError(
        `\`${symbolAcessSrc}\` is just a namespace. Doesn't represent a function!`,
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
      return [`${funcSrc}(${argsSrc})`, null];
    }
    if (isMarkedFunctionWithEnv(writer)) {
      if (env.transpileState.mode !== "repl") {
        const symbolAcessSrc = showSymbolAccess(sym);
        return new TranspileError(
          `\`${symbolAcessSrc}\` is NOT currently available except in REPL or a macro definition.`,
        );
      }

      const argsSrc = await transpileJoinWithComma(args, env);
      if (TranspileError.is(argsSrc)) {
        return argsSrc;
      }
      return [`${funcSrc}.call(${CU_ENV},${argsSrc})`, null];
    }

    if (isMarkedDirectWriter(writer)) {
      const src = await writer.call(env, ...args);
      return TranspileError.is(src) ? src : [src, null];
    }

    if (isMacro(writer)) {
      const generatedForm = await writer.expand(env, ...args);
      if (TranspileError.is(generatedForm)) {
        return generatedForm;
      }
      return await transpileExpressionWithNextCall(generatedForm, env);
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
): Promise<JsSrc | TranspileError> {
  let objectContents = "";
  for (const kv of ast) {
    let kvSrc: JsSrc;
    if (isKeyValue(kv)) {
      const { key, value } = kv;
      let kSrc: JsSrc;
      if (isCuSymbol(key)) {
        kSrc = key.value;
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

      kvSrc = `${kSrc}:${vSrc}`;
    } else if (isCuSymbol(kv)) {
      const f = EnvF.referTo(env, kv);
      if (TranspileError.is(f)) {
        return f;
      }
      if (EnvF.writerIsAtReplTopLevel(env, f)) {
        kvSrc = `${kv.value}: ${pseudoTopLevelReference(kv.value)}`;
      } else {
        kvSrc = kv.value;
      }
    } else if (isUnquote(kv)) {
      return new TranspileError("Unquote must be used inside quasiQuote");
    } else {
      throw ExpectNever(kv);
    }
    objectContents = `${objectContents}${kvSrc},`;
  }
  return `{${objectContents}}`;
}

export async function transpileComputedKeyOrExpression(
  key: ComputedKey<Form> | Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  if (isComputedKey(key)) {
    const r = await transpileExpression(key.value, env);
    if (TranspileError.is(r)) {
      return r;
    }
    return `[${r}]`;
  } else {
    const r = await transpileExpression(key, env);
    if (TranspileError.is(r)) {
      return r;
    }
    return r;
  }
}

export async function transpileBlock(
  forms: Block,
  env: Env,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<JsSrc | TranspileError> {
  const jsSrc = await transpileBlockCore(forms, env, extraOptions);

  if (TranspileError.is(jsSrc)) {
    return jsSrc;
  }
  const [body, lastExpression] = jsSrc;
  if (lastExpression !== "") {
    return `${body}export default ${lastExpression}`;
  }

  return body;
}

export async function transpileBlockCore(
  forms: Block,
  env: Env,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<[JsSrc, JsSrc] | TranspileError> {
  let jsSrc = "";
  for (const form of forms.slice(0, -1)) {
    const s = await transpileExpression(form, env);
    if (s instanceof Error) {
      return s;
    }
    jsSrc = `${jsSrc}${s};\n`;
  }

  const lastForm = forms[forms.length - 1];
  if (lastForm === undefined) {
    return ["", ""];
  }

  const last = await transpileExpression(lastForm, env);
  if (last instanceof Error) {
    return last;
  }

  const lastIsExpression = !isStatement(env, lastForm);
  if (lastIsExpression && extraOptions.mayHaveResult) {
    return [jsSrc, last];
  }

  jsSrc = `${jsSrc}${last};\n`;

  return [jsSrc, ""];
}

export async function transpileString(
  input: ReaderInput,
  env: Env,
): Promise<JsSrc | Error> {
  const forms = readBlock(input);
  if (ParseError.is(forms)) {
    return forms;
  }
  return await transpileBlock(forms, env);
}

// TODO: accept only expression form (not a statement)
export async function transpileJoinWithComma(
  xs: Form[],
  env: Env,
): Promise<JsSrc | TranspileError> {
  let result = "";
  const lastI = xs.length - 1;
  for (const [i, x] of xs.entries()) {
    const r = await transpileExpression(x, env);
    if (TranspileError.is(r)) {
      return r;
    }
    if (i === lastI) {
      result = `${result}${r}`;
    } else {
      result = `${result}${r},`;
    }
  }
  return result;
}
