import * as EnvF from "./env.js";
import { Block, Env, Form } from "./types.js";
import { transpileStatement, transpileBlock } from "./transpile.js";
import { evalAsync } from "./eval/worker-controller.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

export async function evalForm(ast: Form, env: Env): Promise<any | Error> {
  const jsSrc = await transpileStatement(ast, EnvF.forRepl(env, "evalForm"));
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  try {
    return await evalAsync(jsSrc);
  } catch (e) {
    return e;
  }
}

export async function evalBlock(forms: Block, env: Env): Promise<any | Error> {
  const jsSrc = await transpileBlock(forms, EnvF.forRepl(env, "evalBlock"));
  if (jsSrc instanceof Error) {
    return jsSrc;
  }

  try {
    return await evalAsync(jsSrc);
  } catch (e) {
    return e;
  }
}
