import { Block, Env, Form } from "./types.js";
import { transpile, transpileBlock } from "./transpile.js";

export function evalForm(ast: Form, env: Env): any | Error {
  const jsSrc = transpile(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return eval(jsSrc);
}

export function evalBlock(forms: Block, env: Env): any | Error {
  const jsSrc = transpileBlock(forms, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return eval(jsSrc);
}
