// import { pr } from "./util/debug";

import { Env, Form, isCuSymbol, JsSrc, TranspileError } from "./types.js";

export const initialEnv: Env = new Map();

initialEnv.set("addF", transpiling2((a: JsSrc, b: JsSrc) => `(${a} + ${b})`));
initialEnv.set("subF", transpiling2((a: JsSrc, b: JsSrc) => `(${a} - ${b})`));
initialEnv.set("mulF", transpiling2((a: JsSrc, b: JsSrc) => `(${a} * ${b})`));
initialEnv.set("divF", transpiling2((a: JsSrc, b: JsSrc) => `(${a} / ${b})`));

export function transpile(ast: Form, env: Env): JsSrc | TranspileError {
  if (ast instanceof Array) {
    const [sym, ...args] = ast;
    if (!isCuSymbol(sym)) {
      return new TranspileError(`${JSON.stringify(sym)} is not a symbol!`);
    }
    const f = env.get(sym.v);
    if (f === undefined){
      return new TranspileError(`No function ${JSON.stringify(sym)} is found!`);
    }
    return f(env, ...args);
  }
  switch (typeof ast) {
    case "string":
      return JSON.stringify(ast);
    case "undefined":
    case "number":
    case "boolean":
      return `${ast}`;
    case "object":
      switch (ast.t) {
        case "Symbol":
          return JSON.stringify(ast.v);
        case "Integer32":
          return `${ast.v}`;
      }
  }
}

export function transpiling2(f: (a: JsSrc, b: JsSrc) => JsSrc): (env: Env, a: Form, b: Form) => (JsSrc | TranspileError) {
  return (env: Env, a: Form, b: Form): (JsSrc | TranspileError) => {
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
