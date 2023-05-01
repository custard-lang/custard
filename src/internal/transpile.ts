import { assertNonNull, expectNever, mapAE } from "../util/error.js";

import {
  Block,
  Call,
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
  // TODO: Rename into buildJsFunctionCall
  async function buildJsSrc(
    funcExpSrc: JsSrc,
    args: Form[],
  ): Promise<JsSrc | TranspileError> {
    const argSrcs = await mapAE(
      args,
      TranspileError,
      async (arg) => await transpileExpression(arg, env),
    );
    if (argSrcs instanceof TranspileError) {
      return argSrcs;
    }
    return `${funcExpSrc}(${argSrcs.join(", ")})`;
  }

  if (ast instanceof Array) {
    const [sym, ...args] = ast;

    if (isCall(sym)) {
      const funcSrc = await transpileExpression(sym, env);
      if (funcSrc instanceof TranspileError) {
        return funcSrc;
      }

      return await buildJsSrc(`(${funcSrc})`, args);
    }

    let fullId: Id;
    let f: EnvF.WriterWithIsAtTopLevel | TranspileError;
    if (isCuSymbol(sym)) {
      f = EnvF.referTo(env, sym);
      if (f instanceof TranspileError) {
        return f;
      }

      if (f.isAtTopLevel) {
        fullId = pseudoTopLevelReference(sym);
      } else {
        fullId = sym.v;
      }
    } else if (isPropertyAccess(sym)) {
      f = EnvF.referTo(env, sym);
      if (f instanceof TranspileError) {
        return f;
      }

      if (f.isAtTopLevel) {
        fullId = pseudoTopLevelReferenceToPropertyAccess(sym);
      } else {
        fullId = sym.v.join(".");
      }
    } else {
      return new TranspileError(`${JSON.stringify(sym)} is not a symbol!`);
    }

    if (isContextualKeyword(f.writer)) {
      return new TranspileError(
        `\`${showSymbolAccess(sym)}\` must be used with \`${
          f.writer.companion
        }\`!`,
      );
    }
    if (isNamespace(f.writer)) {
      return new TranspileError(
        `\`${showSymbolAccess(
          sym,
        )}\` is just a namespace. Doesn't represent a function!`,
      );
    }

    if (isVar(f.writer) || isConst(f.writer) || isRecursiveConst(f.writer)) {
      return await buildJsSrc(fullId, args);
    }
    if (isMarkedFunctionWithEnv(f.writer)) {
      const argSrcs = await mapAE(
        args,
        TranspileError,
        async (arg) => await transpileExpression(arg, env),
      );
      if (argSrcs instanceof TranspileError) {
        return argSrcs;
      }
      argSrcs.unshift(CU_ENV);
      return `${fullId}.call(${argSrcs.join(", ")})`;
    }

    if (isMarkedDirectWriter(f.writer)) {
      const r = f.writer.call(env, ...args);
      if (r instanceof Promise) {
        return await r;
      }
      return r;
    }

    return expectNever(f.writer) as JsSrc;
  }

  let r: EnvF.WriterWithIsAtTopLevel | TranspileError;
  switch (typeof ast) {
    case "string":
      return JSON.stringify(ast);
    case "undefined":
      return "void 0";
    case "number":
      return `${ast}`;
    case "boolean":
      return ast ? "!0" : "!1";
    case "object":
      switch (ast.t) {
        case "Symbol":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          if (r.isAtTopLevel) {
            return pseudoTopLevelReference(ast);
          }
          return ast.v;
        case "PropertyAccess":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          if (r.isAtTopLevel) {
            return pseudoTopLevelReferenceToPropertyAccess(ast);
          }
          return ast.v.join(".");
        case "KeyValues":
          return await transpileKeyValues(ast, env);
        case "Integer32":
          return `${ast.v}`;
      }
    default:
      return expectNever(ast) as JsSrc;
  }
}

type NextCall = {
  writer: Writer;
  args: Form[];
};

async function transpileExpressionWithNextCall(
  ast: Form,
  env: Env,
): Promise<[JsSrc, NextCall | undefined] | TranspileError> {}

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

function isCall(form: Form): form is Call {
  return (
    form instanceof Array && (isCuSymbol(form[0]) || isPropertyAccess(form[0]))
  );
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
