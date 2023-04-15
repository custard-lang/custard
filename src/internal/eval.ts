import { Env, TranspileRepl } from "./types.js";
import { Block, Form } from "../types.js";
import { transpileStatement, transpileBlock } from "./transpile.js";
import { _cu$eval } from "./isolated-eval.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

export async function evalForm(
  ast: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileStatement(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  try {
    return await _cu$eval("", jsSrc, env);
  } catch (e) {
    return e;
  }
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileBlock(forms.slice(0, -1), env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  const lastJsSrc = await transpileStatement(forms[forms.length - 1], env);
  if (lastJsSrc instanceof Error) {
    return lastJsSrc;
  }

  try {
    return await _cu$eval(jsSrc, lastJsSrc, env);
  } catch (e) {
    return e;
  }
}
