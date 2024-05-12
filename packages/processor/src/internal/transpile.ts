import { ExpectNever } from "../util/error.js";

import {
  Block,
  Call,
  canBePseudoTopLevelReferenced,
  CuSymbol,
  DynamicVar,
  Form,
  isContextualKeyword,
  isCuSymbol,
  isDynamicVar,
  isKeyValue,
  isList,
  isMarkedDirectWriter,
  isMarkedFunctionWithEnv,
  isNamespace,
  isPropertyAccess,
  isProvidedConst,
  JsSrc,
  LiteralObject,
  PropertyAccess,
  ReaderInput,
  showSymbolAccess,
  TranspileError,
  Writer,
} from "../internal/types.js";
import {
  CU_ENV,
  pseudoTopLevelReference,
  pseudoTopLevelReferenceToPropertyAccess,
} from "./cu-env.js";
import { Env } from "./types.js";
import * as EnvF from "./env.js";
import { readBlock } from "../reader.js";
import { ParseError } from "../grammar.js";
import { isStatement } from "../lib/base/common.js";

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

type NextCall = {
  writer: Writer;
  sym: CuSymbol | PropertyAccess;
};

type JsSrcAndNextCall = [JsSrc, NextCall | undefined];

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
    return [rw, undefined];
  }

  switch (ast.t) {
    case "String":
      return [JSON.stringify(ast.v), undefined];
    case "ReservedSymbol":
      switch (ast.v) {
        case true:
          return ["true", undefined];
        case false:
          return ["false", undefined];
        case null:
          return ["null", undefined];
      }
    case "Integer32":
    case "Float64":
      return [`${ast.v}`, undefined];
    case "Symbol": {
      const r = EnvF.referTo(env, ast);
      if (TranspileError.is(r)) {
        return r;
      }
      if (isDynamicVar(r.writer)) {
        return await expandDynamicVar(r.writer);
      }
      if (EnvF.writerIsAtReplTopLevel(env, r)) {
        return [pseudoTopLevelReference(ast.v), { writer: r.writer, sym: ast }];
      }
      return [ast.v, { writer: r.writer, sym: ast }];
    }
    case "PropertyAccess": {
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
      return [ast.v.join("."), { writer: r.writer, sym: ast }];
    }
    case "Array": {
      const elementsSrc = await transpileJoinWithComma(ast.v, env);
      if (TranspileError.is(elementsSrc)) {
        return elementsSrc;
      }
      return [`[${elementsSrc}]`, undefined];
    }
    case "Object": {
      const kvSrc = await transpileLiteralObject(ast, env);
      if (TranspileError.is(kvSrc)) {
        return kvSrc;
      }
      return [kvSrc, undefined];
    }
    case "List": {
      const [funcForm, ...args] = ast.v;
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

      if (nc === undefined) {
        const argsSrc = await transpileJoinWithComma(args, env);
        if (TranspileError.is(argsSrc)) {
          return argsSrc;
        }
        return [`(${funcSrc})(${argsSrc})`, undefined];
      }

      const { writer, sym } = nc;
      if (isContextualKeyword(writer)) {
        return new TranspileError(
          `\`${showSymbolAccess(sym)}\` must be used with \`${
            writer.companion
          }\`!`,
        );
      }
      if (isNamespace(writer)) {
        return new TranspileError(
          `\`${showSymbolAccess(
            sym,
          )}\` is just a namespace. Doesn't represent a function!`,
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
        return [`${funcSrc}(${argsSrc})`, undefined];
      }
      if (isMarkedFunctionWithEnv(writer)) {
        const argsSrc = await transpileJoinWithComma(args, env);
        if (TranspileError.is(argsSrc)) {
          return argsSrc;
        }
        return [`${funcSrc}.call(${CU_ENV},${argsSrc})`, undefined];
      }

      if (isMarkedDirectWriter(writer)) {
        const srcP = writer.call(env, ...args);
        const src = srcP instanceof Promise ? await srcP : srcP;
        return TranspileError.is(src) ? src : [src, undefined];
      }

      throw ExpectNever(writer);
    }
    case "Unquote":
      return new TranspileError("Unquote should be used inside quasiQuote");
    case "Splice":
      return new TranspileError("Splice should be used inside quasiQuote");
    default:
      throw ExpectNever(ast);
  }
}

async function transpileLiteralObject(
  ast: LiteralObject,
  env: Env,
): Promise<JsSrc | TranspileError> {
  let objectContents = "";
  for (const kv of ast.v) {
    let kvSrc: JsSrc;
    if (isKeyValue(kv)) {
      const [k, v] = kv;
      // TODO: only CuSymbol and LiteralArray with only one element should be valid.
      const kSrc = isCuSymbol(k) ? k.v : await transpileExpression(k, env);
      if (TranspileError.is(kSrc)) {
        return kSrc;
      }

      const vSrc = await transpileExpression(v, env);
      if (TranspileError.is(vSrc)) {
        return vSrc;
      }

      kvSrc = `${kSrc}:${vSrc}`;
    } else {
      const f = EnvF.referTo(env, kv);
      if (TranspileError.is(f)) {
        return f;
      }
      if (EnvF.writerIsAtReplTopLevel(env, f)) {
        kvSrc = `${kv.v}: ${pseudoTopLevelReference(kv.v)}`;
      } else {
        kvSrc = kv.v;
      }
    }
    objectContents = `${objectContents}${kvSrc},`;
  }
  return `{${objectContents}}`;
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
  return transpileBlock(forms, env);
}

export function asCall(form: Form): Call | undefined {
  if (!isList(form)) {
    return;
  }
  const id = form.v[0];
  if (id === undefined) {
    return;
  }
  if (isCuSymbol(id) || isPropertyAccess(id)) {
    return form as Call;
  }
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
