import { type Env, type TranspileRepl } from "./types.js";
import { type Form, type Block } from "../types.js";

import { transpileBlockCore } from "./transpile.js";
import { evalKtvals } from "./ktvals.js";

// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function evalForm(
  form: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  return await evalBlock([form], env);
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const resultKtvalsOffset = await transpileBlockCore(forms, env, {
    mayHaveResult: true,
  });

  if (resultKtvalsOffset instanceof Error) {
    return resultKtvalsOffset;
  }

  const notYetEvaluatedBeforeLastStatement =
    env.transpileState.transpiledSrc.slice(
      env.transpileState.evaluatedUpTo,
      resultKtvalsOffset,
    );
  const lastStatement =
    env.transpileState.transpiledSrc.slice(resultKtvalsOffset);
  return await evalKtvals(
    notYetEvaluatedBeforeLastStatement,
    lastStatement,
    env,
  );
}
