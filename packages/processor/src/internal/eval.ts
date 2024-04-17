import { Env, ReaderInput, TranspileRepl } from "./types.js";
import { Block, Form } from "../types.js";
import { transpileBlockCore, transpileExpression } from "./transpile.js";
import { _cu$eval } from "./isolated-eval.js";

import { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

// TODO: Delete
export async function evalForm(
  ast: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileExpression(ast, env);
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
  const jsMod = await transpileBlockCore(forms, env, { mayHaveResult: true });
  if (jsMod instanceof Error) {
    return jsMod;
  }

  try {
    return await _cu$eval(jsMod[0], jsMod[1], env);
  } catch (e) {
    return e;
  }
}

export async function evalString(
  input: ReaderInput,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const forms = readBlock(input);
  if (ParseError.is(forms)) {
    return forms;
  }
  return evalBlock(forms, env);
}
