// import { pr } from "./util/debug.js";
// import { prDebugOut, writeDebugOut } from "./util/debug.js";
import { mapE } from "./util/error.js";

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
} from "./types.js";
import * as EnvF from "./env.js";

export function transpile(ast: Form, env: Env): JsSrc | TranspileError {
  if (ast instanceof Array) {
    const [sym, ...args] = ast;

    if (isCall(sym)) {
      const funcSrc = transpile(sym, env);
      if (funcSrc instanceof TranspileError) {
        return funcSrc;
      }

      const argSrcs = mapE(args, TranspileError, (arg) => transpile(arg, env));
      if (argSrcs instanceof TranspileError) {
        return argSrcs;
      }

      return `(${funcSrc})(${argSrcs.join(", ")})`;
    }

    if (!isCuSymbol(sym)) {
      return new TranspileError(`${JSON.stringify(sym)} is not a symbol!`);
    }
    const f = EnvF.referTo(env, sym.v);
    if (f instanceof TranspileError) {
      return f;
    }
    if (isAContextualKeyword(f)) {
      return new TranspileError(
        `\`${sym.v}\` must be used with \`${f.companion}\`!`
      );
    }

    if (isVar(f) || isConst(f) || isRecursiveConst(f)) {
      const argSrcs = mapE(args, TranspileError, (arg) => transpile(arg, env));
      if (argSrcs instanceof TranspileError) {
        return argSrcs;
      }

      return `${sym.v}(${argSrcs.join(", ")})`;
    }
    return f(env, ...args);
  }
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
          const r = EnvF.referTo(env, ast.v);
          if (r instanceof TranspileError) {
            return r;
          }
          return ast.v;
        case "Integer32":
          return `${ast.v}`;
      }
  }
}

export function transpileBlock(forms: Block, env: Env): JsSrc | TranspileError {
  let jsSrc = "";
  for (const form of forms) {
    const s = transpile(form, env);
    if (s instanceof Error) {
      return s;
    }
    jsSrc = `${jsSrc}${s};\n`;
  }
  return jsSrc;
}

export function transpiling1(
  formId: Id,
  f: (a: JsSrc) => JsSrc
): (env: Env, a: Form, ...unused: Form[]) => JsSrc | TranspileError {
  return (env: Env, a: Form, ...unused: Form[]): JsSrc | TranspileError => {
    const ra = transpile(a, env);
    if (ra instanceof TranspileError) {
      return ra;
    }

    if (unused.length > 0) {
      return new TranspileError(
        `\`${formId}\` must receive exactly one expression!`
      );
    }

    return f(ra);
  };
}

export function transpiling2(
  f: (a: JsSrc, b: JsSrc) => JsSrc
): (env: Env, a: Form, b: Form) => JsSrc | TranspileError {
  return (env: Env, a: Form, b: Form): JsSrc | TranspileError => {
    const ra = transpile(a, env);
    if (ra instanceof TranspileError) {
      return ra;
    }

    const rb = transpile(b, env);
    if (rb instanceof TranspileError) {
      return rb;
    }

    return f(ra, rb);
  };
}

// TODO: Handle assignment to reserved words etc.
export function transpilingForAssignment(
  formId: Id,
  f: (env: Env, id: CuSymbol, exp: JsSrc) => JsSrc | TranspileError
): Writer {
  return (env: Env, id: Form, v: Form, another?: Form) => {
    if (another != null) {
      return new TranspileError(
        `The number of arguments to \`${formId}\` must be 2!`
      );
    }
    if (!isCuSymbol(id)) {
      return new TranspileError(`${JSON.stringify(id)} is not a symbol!`);
    }

    const exp = transpile(v, env);
    if (exp instanceof TranspileError) {
      return exp;
    }
    return f(env, id, exp);
  };
}

export function transpilingForVariableMutation(
  formId: Id,
  operator: JsSrc
): Writer {
  return (env: Env, id: Form, another?: Form) => {
    if (another !== undefined) {
      return new TranspileError(`\`${formId}\` must receive only one symbol!`);
    }

    if (!isCuSymbol(id)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable!`
      );
    }

    const val = EnvF.find(env, id.v);
    if (val === undefined || !isVar(val)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable declared by \`let\`!`
      );
    }

    return `${id.v}${operator}`;
  };
}

export function isCall(form: Form): form is Call {
  return form instanceof Array && isCuSymbol(form[0]);
}
