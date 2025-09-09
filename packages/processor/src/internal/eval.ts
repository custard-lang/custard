import { type Context, type TranspileRepl } from "./types.js";
import { type Form, type Block } from "../types.js";

import { transpileBlockCore } from "./transpile.js";
import { evalKtvals } from "./ktvals.js";

// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function evalForm(
  form: Form,
  context: Context<TranspileRepl>,
): Promise<any | Error> {
  return await evalBlock([form], context);
}

export async function evalBlock(
  forms: Block,
  context: Context<TranspileRepl>,
): Promise<any | Error> {
  const resultKtvalsOffset = await transpileBlockCore(forms, context, {
    mayHaveResult: true,
  });

  if (resultKtvalsOffset instanceof Error) {
    return resultKtvalsOffset;
  }

  const notYetEvaluatedBeforeLastStatement =
    context.transpileState.transpiledSrc.slice(
      context.transpileState.evaluatedUpTo,
      resultKtvalsOffset,
    );
  const lastStatement =
    context.transpileState.transpiledSrc.slice(resultKtvalsOffset);
  return await evalKtvals(
    notYetEvaluatedBeforeLastStatement,
    lastStatement,
    context,
  );
}
