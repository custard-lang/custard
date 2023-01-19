// import { pr } from "./util/debug.js";
// import { prDebugOut, writeDebugOut } from "./util/debug.js";
import { assertNonNull, mapAE } from "./util/error.js";

import {
  Block,
  Call,
  CuSymbol,
  Env,
  Form,
  Id,
  isAContextualKeyword,
  isVar,
  isCuSymbol,
  JsSrc,
  TranspileError,
  Writer,
  isConst,
  isRecursiveConst,
  isPropertyAccess,
  showSymbolAccess,
} from "./types.js";
import * as EnvF from "./env.js";

export async function transpileStatement(
  ast: Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  if (env.o.mode === "repl" && env.o.awaitingId !== undefined) {
    const restSrc = await transpileExpression(ast, env);
    if (restSrc instanceof TranspileError) {
      return restSrc;
    }
    const promiseIdS = JSON.stringify(`__cu$promise_${env.o.awaitingId}`);
    const result = `__cu$Context.get(${promiseIdS}).then((${env.o.awaitingId}) => {\nreturn ${restSrc};\n})`;
    env.o.awaitingId = undefined;
    return result;
  }
  return await transpileExpression(ast, env);
}

export async function transpileExpression(
  ast: Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  if (ast instanceof Array) {
    const [sym, ...args] = ast;

    if (isCall(sym)) {
      const funcSrc = await transpileExpression(sym, env);
      if (funcSrc instanceof TranspileError) {
        return funcSrc;
      }

      const argSrcs = await mapAE(
        args,
        TranspileError,
        async (arg) => await transpileExpression(arg, env),
      );
      if (argSrcs instanceof TranspileError) {
        return argSrcs;
      }

      return `(${funcSrc})(${argSrcs.join(", ")})`;
    }

    let id: Id;
    let fullId: Id;
    if (isCuSymbol(sym)) {
      id = sym.v;
      fullId = id;
    } else if (isPropertyAccess(sym)) {
      id = assertNonNull(sym.v[0], "Assertion failure: empty PropertyAccess");
      fullId = sym.v.join(".");
    } else {
      return new TranspileError(`${JSON.stringify(sym)} is not a symbol!`);
    }
    const f = EnvF.referTo(env, id);
    if (f instanceof TranspileError) {
      return f;
    }

    if (isAContextualKeyword(f)) {
      return new TranspileError(
        `\`${showSymbolAccess(sym)}\` must be used with \`${f.companion}\`!`,
      );
    }

    if (isVar(f) || isConst(f) || isRecursiveConst(f)) {
      const argSrcs = await mapAE(
        args,
        TranspileError,
        async (arg) => await transpileExpression(arg, env),
      );
      if (argSrcs instanceof TranspileError) {
        return argSrcs;
      }

      return `${fullId}(${argSrcs.join(", ")})`;
    }

    const r = f(env, ...args);
    if (r instanceof Promise) {
      return await r;
    }
    return r;
  }

  let r: Writer | TranspileError;
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
          r = EnvF.referTo(env, ast.v);
          if (r instanceof TranspileError) {
            return r;
          }
          return ast.v;
        case "PropertyAccess":
          r = EnvF.referTo(
            env,
            assertNonNull(
              ast.v[0],
              "Assertion failure: PropertyAccess with no symbol.",
            ),
          );
          if (r instanceof TranspileError) {
            return r;
          }
          return ast.v.join(".");
        case "Integer32":
          return `${ast.v}`;
      }
  }
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
    jsSrc = `${jsSrc}${s};\n`;
  }
  return jsSrc;
}

export function transpiling1(
  formId: Id,
  f: (a: JsSrc) => JsSrc,
): (env: Env, a: Form, ...unused: Form[]) => Promise<JsSrc | TranspileError> {
  return async (
    env: Env,
    a: Form,
    ...unused: Form[]
  ): Promise<JsSrc | TranspileError> => {
    const ra = await transpileExpression(a, env);
    if (ra instanceof TranspileError) {
      return ra;
    }

    if (unused.length > 0) {
      return new TranspileError(
        `\`${formId}\` must receive exactly one expression!`,
      );
    }

    return f(ra);
  };
}

export function transpiling2(
  f: (a: JsSrc, b: JsSrc) => JsSrc,
): (env: Env, a: Form, b: Form) => Promise<JsSrc | TranspileError> {
  return async (
    env: Env,
    a: Form,
    b: Form,
  ): Promise<JsSrc | TranspileError> => {
    const ra = await transpileExpression(a, env);
    if (ra instanceof TranspileError) {
      return ra;
    }

    const rb = await transpileExpression(b, env);
    if (rb instanceof TranspileError) {
      return rb;
    }

    return f(ra, rb);
  };
}

// TODO: Handle assignment to reserved words etc.
export function transpilingForAssignment(
  formId: Id,
  f: (env: Env, id: CuSymbol, exp: JsSrc) => JsSrc | TranspileError,
): Writer {
  return async (env: Env, id: Form, v: Form, another?: Form) => {
    if (another != null) {
      return new TranspileError(
        `The number of arguments to \`${formId}\` must be 2!`,
      );
    }
    if (!isCuSymbol(id)) {
      return new TranspileError(`${JSON.stringify(id)} is not a symbol!`);
    }

    const exp = await transpileExpression(v, env);
    if (exp instanceof TranspileError) {
      return exp;
    }
    return f(env, id, exp);
  };
}

export function transpilingForVariableMutation(
  formId: Id,
  operator: JsSrc,
): Writer {
  return (env: Env, id: Form, another?: Form) => {
    if (another !== undefined) {
      return new TranspileError(`\`${formId}\` must receive only one symbol!`);
    }

    if (!isCuSymbol(id)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable!`,
      );
    }

    const val = EnvF.find(env, id.v);
    if (val === undefined || !isVar(val)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable declared by \`let\`!`,
      );
    }

    return `${id.v}${operator}`;
  };
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
