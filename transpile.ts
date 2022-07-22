// import { pr } from "./util/debug";

import {
  Env,
  Form,
  isCuSymbol,
  JsSrc,
  Scope,
  TranspileError,
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

export const builtin: Scope = new Map();

builtin.set(
  "addF",
  transpiling2((a: JsSrc, b: JsSrc) => `(${a} + ${b})`)
);
builtin.set(
  "subF",
  transpiling2((a: JsSrc, b: JsSrc) => `(${a} - ${b})`)
);
builtin.set(
  "mulF",
  transpiling2((a: JsSrc, b: JsSrc) => `(${a} * ${b})`)
);
builtin.set(
  "divF",
  transpiling2((a: JsSrc, b: JsSrc) => `(${a} / ${b})`)
);

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
