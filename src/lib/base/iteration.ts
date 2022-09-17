import { Env, Form, JsSrc, Scope, TranspileError } from "../../types";

export namespace Iteration {
  export function __break(_env: Env, ...rest: Form[]): JsSrc | TranspileError {
    if (rest.length > 0) {
      return new TranspileError("");
    }
    return "break";
  }
}

export function iteration(): Scope {
  const b = new Map();

  b.set("break", Iteration.__break);

  return b;
}
