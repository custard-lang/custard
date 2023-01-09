import * as EnvF from "./env.js";
import { Block, Env, Form } from "./types.js";
import { transpileStatement, transpileBlock } from "./transpile.js";
import { __cu$evalJs } from "./eval/isolated.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

export async function evalForm(ast: Form, env: Env): Promise<any | Error> {
  EnvF.forceToBeRepl(env, "evalForm");
  const jsSrc = await transpileStatement(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return await __cu$evalJs(jsSrc, env);
}

export async function evalBlock(forms: Block, env: Env): Promise<any | Error> {
  EnvF.forceToBeRepl(env, "evalBlock");
  const jsSrc = await transpileBlock(forms, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }

  return await __cu$evalJs(jsSrc, env);
}
