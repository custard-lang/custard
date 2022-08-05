// import { pr } from "./util/debug";

import {
  CuSymbol,
  Env,
  Form,
  isCuSymbol,
  JsSrc,
  Scope,
  TranspileError,
  Writer,
} from "./types.js";
import * as EnvF from "./env.js";

export function transpile(ast: Form, env: Env): JsSrc | TranspileError {
  if (ast instanceof Array) {
    const [sym, ...args] = ast;
    if (!isCuSymbol(sym)) {
      return new TranspileError(`${JSON.stringify(sym)} is not a symbol!`);
    }
    const f = EnvF.find(env, sym.v);
    if (f === undefined) {
      return new TranspileError(
        `No function ${JSON.stringify(sym.v)} is defined!`
      );
    }
    if (f === "Var") {
      return `${sym.v}`; // TODO: Call function after transpiling args
    }
    return f(env, ...args);
  }
  switch (typeof ast) {
    case "string":
      return JSON.stringify(ast);
    case "undefined":
      return "void 0";
    case "number":
    case "boolean":
      return `${ast}`;
    case "object":
      switch (ast.t) {
        case "Symbol":
          if (EnvF.find(env, ast.v) === undefined) {
            return new TranspileError(
              `No variable ${JSON.stringify(ast.v)} is defined!`
            );
          }
          return ast.v;
        case "Integer32":
          return `${ast.v}`;
      }
  }
}

export function builtin(): Scope {
  const b = new Map();

  // TODO: Rename into plus, minus, times, and dividedBy.
  b.set(
    "addF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} + ${b})`)
  );
  b.set(
    "subF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} - ${b})`)
  );
  b.set(
    "mulF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} * ${b})`)
  );
  b.set(
    "divF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} / ${b})`)
  );

  b.set(
    "const",
    transpilingForAssignment((env: Env, id: CuSymbol, exp: JsSrc) => {
      const alreadyDefined = !!EnvF.find(env, id.v);
      if (alreadyDefined) {
        return new TranspileError(
          `Variable ${JSON.stringify(id.v)} is already defined!`
        );
      }
      EnvF.set(env, id.v, "Var");
      return `const ${id.v} = ${exp};\n`;
    })
  );

  b.set(
    "let",
    transpilingForAssignment((env: Env, id: CuSymbol, exp: JsSrc) => {
      const alreadyDefined = !!EnvF.find(env, id.v);
      if (alreadyDefined) {
        return new TranspileError(
          `Variable ${JSON.stringify(id.v)} is already defined!`
        );
      }
      EnvF.set(env, id.v, "Var");
      return `let ${id.v} = ${exp};\n`;
    })
  );

  b.set(
    "assign",
    transpilingForAssignment((_env: Env, id: CuSymbol, exp: JsSrc) => {
      return `${id.v} = ${exp};\n`;
    })
  );

  return b;
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
function transpilingForAssignment(
  f: (env: Env, id: CuSymbol, exp: JsSrc) => JsSrc | TranspileError
): Writer {
  return (env: Env, id: Form, v: Form) => {
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
