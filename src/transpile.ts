import { transpileStatement } from "./internal/transpile.js";
import * as State from "./internal/transpile-state.js";
import * as EnvF from "./internal/env.js";

import type {
  Block,
  JsSrc,
  ProvidedSymbols,
  TranspileError,
  TranspileOptions,
} from "./types.js";

export async function transpileModule(
  ast: Block,
  transpileOptions: TranspileOptions,
  proviedSymbols: ProvidedSymbols,
): Promise<JsSrc | TranspileError> {
  return await transpileStatement(
    ast,
    await EnvF.init(
      proviedSymbols.initialScope,
      await State.transpileModule(transpileOptions),
      proviedSymbols.modulePaths,
    ),
  );
}
