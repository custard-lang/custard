import { Env, TranspileRepl } from "./types.js";
import { Block, Form } from "../types.js";
import { transpileStatement, transpileBlock } from "./transpile.js";
import { __cu$eval } from "./isolated-eval.js";

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
    return await __cu$eval(jsSrc, env);
  } catch (e) {
    return e;
  }
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileBlock(forms, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }

  try {
    return await __cu$eval(jsSrc, env);
  } catch (e) {
    return e;
  }
}
