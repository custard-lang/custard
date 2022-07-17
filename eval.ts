import { Env, Form } from "./types";
import { transpile } from "./transpile";

export { initialEnv } from "./transpile";

export function evalAst(ast: Form, env: Env): any | Error {
  const jsSrc = transpile(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return eval(jsSrc);
}
