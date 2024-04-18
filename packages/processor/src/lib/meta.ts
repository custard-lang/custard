import {
  Env,
  TranspileRepl,
  Block,
  markAsFunctionWithEnv,
  FilePath,
} from "../internal/types.js";
import { evalBlock } from "../internal/eval.js";
import { srcPathForErrorMessage } from "../internal/env.js";

import { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";
export { transpileModule } from "../transpile.js";

export const readString = markAsFunctionWithEnv(
  (
    env: Env,
    contents: string,
    path: FilePath = srcPathForErrorMessage(env),
  ): Block | ParseError => {
    return readBlock({ contents, path });
  },
);

export const evaluate = markAsFunctionWithEnv(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (env: Env, block: Block): any | Error => {
    if (env.transpileState.mode === "repl") {
      // Dirty workaround for https://github.com/microsoft/TypeScript/issues/42384
      return evalBlock(block, env as Env<TranspileRepl>);
    }
    throw new Error(
      "Sorry, user `evaluate` function is currently only available in `repl` mode",
    );
  },
);
