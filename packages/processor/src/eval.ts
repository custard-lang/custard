import {
  type Form,
  type Block,
  type Context,
  type ReaderInput,
  type TranspileRepl,
} from "./types.js";
import { isParseError } from "./grammar.js";
import { readBlock } from "./reader.js";

import {
  evalForm as internalEvalForm,
  evalBlock as internalEvalBlock,
} from "./internal/eval.js";
import { clearTranspiledSrc } from "./internal/transpile-state.js";

// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

export async function evalForm(
  form: Form,
  context: Context<TranspileRepl>,
): Promise<any | Error> {
  const r = await internalEvalForm(form, context);
  clearTranspiledSrc(context.transpileState);
  return r;
}

export async function evalBlock(
  forms: Block,
  context: Context<TranspileRepl>,
): Promise<any | Error> {
  const r = await internalEvalBlock(forms, context);
  clearTranspiledSrc(context.transpileState);
  return r;
}

export async function evalString(
  input: ReaderInput,
  context: Context<TranspileRepl>,
): Promise<any | Error> {
  const forms = readBlock(input);
  if (isParseError(forms)) {
    return forms;
  }
  return await evalBlock(forms, context);
}
