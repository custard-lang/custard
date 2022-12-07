import { Scope, Env, Form, Id, JsSrc, TranspileError } from "../../types";

export namespace Iteration {
  export const __break = transpilingControlStatement("break");
  export const __continue = transpilingControlStatement("continue");
}

function transpilingControlStatement(
  id: Id,
): (env: Env, ...rest: Form[]) => JsSrc | TranspileError {
  return function (_env: Env, ...rest: Form[]): JsSrc | TranspileError {
    if (rest.length > 0) {
      return new TranspileError(`\`${id}\` doesn't accept any arguments!`);
    }
    return id;
  };
}

export function iteration(): Scope {
  const b: Scope = new Map();

  b.set("break", Iteration.__break);
  b.set("continue", Iteration.__continue);

  return b;
}
