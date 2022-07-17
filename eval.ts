import { Env, Form } from "./types.js";
import { transpile } from "./transpile.js";

export { initialEnv } from "./transpile.js";

export function evalAst(ast: Form, env: Env): any | Error {
  const jsSrc = transpile(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return eval(jsSrc);
}
