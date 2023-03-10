import { transpileStatement } from "./internal/transpile.js";
import * as State from "./internal/transpile-state.js";
import * as EnvF from "./internal/env.js";

import type {
  Block,
  JsSrc,
  ProvidedSymbolsConfig,
  TranspileError,
  TranspileOptions,
} from "./types.js";
import { fromProvidedSymbolsConfig } from "./internal/scope.js";

export async function transpileModule(
  ast: Block,
  transpileOptions: TranspileOptions,
  proviedSymbols: ProvidedSymbolsConfig,
): Promise<JsSrc | TranspileError> {
  return await transpileStatement(
    ast,
    EnvF.init(
      await fromProvidedSymbolsConfig(proviedSymbols),
      await State.transpileModule(transpileOptions),
      proviedSymbols.modulePaths,
    ),
  );
}
