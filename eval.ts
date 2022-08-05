import { Block, Env, Form } from "./types.js";
import { transpile } from "./transpile.js";

export { builtin } from "./transpile.js";

export function evalForm(ast: Form, env: Env): any | Error {
  const jsSrc = transpile(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return eval(jsSrc);
}

export function evalBlock(forms: Block, env: Env): any | Error {
  let jsSrc = "";
  for (let i = 0; i < forms.length; ++i) {
    const s = transpile(forms[i], env);
    if (s instanceof Error) {
      return s;
    }
    jsSrc += s;
  }
  return eval(jsSrc);
}
