import {
  assertNonNull,
  expectNever,
  mapJoinWithCommaAE,
} from "../util/error.js";

import {
  Block,
  Form,
  Id,
  isContextualKeyword,
  isVar,
  isCuSymbol,
  JsSrc,
  TranspileError,
  Writer,
  isConst,
  isRecursiveConst,
  isPropertyAccess,
  showSymbolAccess,
  isNamespace,
  isMarkedFunctionWithEnv,
  isMarkedDirectWriter,
  KeyValues,
  PropertyAccess,
  CuSymbol,
} from "../internal/types.js";
import {
  CU_ENV,
  pseudoTopLevelReference,
  pseudoTopLevelReferenceToPropertyAccess,
} from "./cu-env.js";
import { Env } from "./types.js";
import * as EnvF from "./env.js";

export async function transpileStatement(
  ast: Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  return await transpileExpression(ast, env);
}

export async function transpileExpression(
  ast: Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  const r = await transpileExpressionWithNextCall(ast, env);
  if (r instanceof TranspileError) {
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
  if (ast instanceof Array) {
    if (ast.length === 0) {
      return new TranspileError("Invalid function call: empty");
    }

    const [funcForm, ...args] = ast;

    const funcSrcAndNextCall = await transpileExpressionWithNextCall(
      funcForm,
      env,
    );
    if (funcSrcAndNextCall instanceof TranspileError) {
      return funcSrcAndNextCall;
    }

    async function transpileArgs(): Promise<JsSrc | TranspileError> {
      return await mapJoinWithCommaAE(
        args,
        TranspileError,
        async (arg) => await transpileExpression(arg, env),
      );
    }

    const [funcSrc, nc] = funcSrcAndNextCall;

    if (nc === undefined) {
      const argsSrc = await transpileArgs();
      if (argsSrc instanceof TranspileError) {
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

    if (isVar(writer) || isConst(writer) || isRecursiveConst(writer)) {
      const argsSrc = await transpileArgs();
      if (argsSrc instanceof TranspileError) {
        return argsSrc;
      }
      return [`${funcSrc}(${argsSrc})`, undefined];
    }
    if (isMarkedFunctionWithEnv(writer)) {
      const argsSrc = await transpileArgs();
      if (argsSrc instanceof TranspileError) {
        return argsSrc;
      }
      return [`${funcSrc}.call(${CU_ENV},${argsSrc})`, undefined];
    }

    if (isMarkedDirectWriter(writer)) {
      const srcP = writer.call(env, ...args);
      const src = srcP instanceof Promise ? await srcP : srcP;
      return src instanceof TranspileError ? src : [src, undefined];
    }

    return expectNever(writer) as JsSrcAndNextCall;
  }

  let r: EnvF.WriterWithIsAtTopLevel | TranspileError;
  switch (typeof ast) {
    case "string":
      return [JSON.stringify(ast), undefined];
    case "undefined":
      return ["void 0", undefined];
    case "number":
      return [`${ast}`, undefined];
    case "boolean":
      return [ast ? "!0" : "!1", undefined];
    case "object":
      switch (ast.t) {
        case "Symbol":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          if (EnvF.writerIsAtReplTopLevel(env, r)) {
            return [
              pseudoTopLevelReference(ast),
              { writer: r.writer, sym: ast },
            ];
          }
          return [ast.v, { writer: r.writer, sym: ast }];
        case "PropertyAccess":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          if (EnvF.writerIsAtReplTopLevel(env, r)) {
            return [
              pseudoTopLevelReferenceToPropertyAccess(ast),
              { writer: r.writer, sym: ast },
            ];
          }
          return [ast.v.join("."), { writer: r.writer, sym: ast }];
        case "KeyValues":
          const kvSrc = await transpileKeyValues(ast, env);
          if (kvSrc instanceof TranspileError) {
            return kvSrc;
          }
          return [kvSrc, undefined];
        case "Integer32":
          return [`${ast.v}`, undefined];
      }
    default:
      return expectNever(ast) as JsSrcAndNextCall;
  }
}

async function transpileKeyValues(
  ast: KeyValues,
  env: Env,
): Promise<JsSrc | TranspileError> {
  let objectContents = "";
  for (const kv of ast.v) {
    let kvSrc: string;
    if (isCuSymbol(kv)) {
      const f = EnvF.referTo(env, kv);
      if (f instanceof TranspileError) {
        return f;
      }
      kvSrc = kv.v;
    } else {
      const [k, v] = kv;
      const kSrc = isCuSymbol(k) ? k.v : await transpileExpression(k, env);
      if (kSrc instanceof TranspileError) {
        return kSrc;
      }

      const vSrc = await transpileExpression(v, env);
      if (vSrc instanceof TranspileError) {
        return vSrc;
      }

      kvSrc = `${kSrc}: ${vSrc}`;
    }
    objectContents = `${objectContents}${kvSrc}, `;
  }
  return `{ ${objectContents} }`;
}

export async function transpileBlock(
  forms: Block,
  env: Env,
): Promise<JsSrc | TranspileError> {
  let jsSrc = "";
  for (const form of forms) {
    const s = await transpileStatement(form, env);
    if (s instanceof Error) {
      return s;
    }
    jsSrc = appendJsStatement(jsSrc, s);
  }
  return jsSrc;
}

export function asCall(form: Form): [Id, ...Form[]] | undefined {
  if (!(form instanceof Array)) {
    return;
  }
  const id = form[0];
  if (isCuSymbol(id)) {
    return [id.v, ...form.slice(1)];
  }
  if (isPropertyAccess(id)) {
    const msg = "Assertion failure: an empty PropertyAccess";
    return [assertNonNull(id.v[0], msg), ...form.slice(1)];
  }
}

export function appendJsStatement(jsBlock: JsSrc, jsExpression: JsSrc): JsSrc {
  return `${jsBlock}${jsExpression};\n`;
}
