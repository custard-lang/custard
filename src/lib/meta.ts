import {
  Env,
  TranspileRepl,
  Block,
  markAsFunctionWithEnv,
} from "../internal/types.js";
import { evalBlock } from "../internal/eval.js";

import { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";
export { transpileModule } from "../transpile.js";

export function readString(input: string): Block | ParseError {
  return readBlock(input);
}

export const evaluate = markAsFunctionWithEnv(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (env: Env, block: Block): any | Error => {
    if (env.transpileState.mode === "repl") {
      // Dirty workaround for https://github.com/microsoft/TypeScript/issues/42384
      return evalBlock(block, env as Env<TranspileRepl>);
    }
  },
);
