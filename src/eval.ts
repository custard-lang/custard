import { Block, Env, Form } from "./types.js";
import { transpile } from "./transpile.js";

export function evalForm(ast: Form, env: Env): any | Error {
  const jsSrc = transpile(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return eval(jsSrc);
}

export function evalBlock(forms: Block, env: Env): any | Error {
  let jsSrc = "";
  for (const form of forms) {
    const s = transpile(form, env);
    if (s instanceof Error) {
      return s;
    }
    jsSrc = `${jsSrc}${s};\n`;
  }
  return eval(jsSrc);
}
