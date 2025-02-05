import {
  type Form,
  type Block,
  type Env,
  type ReaderInput,
  type TranspileRepl,
} from "./types.js";
import { ParseError } from "./grammar.js";
import { readBlock } from "./reader.js";

import {
  evalForm as internalEvalForm,
  evalBlock as internalEvalBlock,
} from "./internal/eval.js";
import { clearTranspiledSrc } from "./internal/transpile-state.js";

export async function evalForm(
  form: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const r = await internalEvalForm(form, env);
  clearTranspiledSrc(env.transpileState);
  return r;
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const r = await internalEvalBlock(forms, env);
  clearTranspiledSrc(env.transpileState);
  return r;
}

export async function evalString(
  input: ReaderInput,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const forms = readBlock(input);
  if (ParseError.is(forms)) {
    return forms;
  }
  return await evalBlock(forms, env);
}
