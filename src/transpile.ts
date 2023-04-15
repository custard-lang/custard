import { transpileBlock } from "./internal/transpile.js";
import { fromDefinitions } from "./internal/scope.js";
import * as State from "./internal/transpile-state.js";
import * as EnvF from "./internal/env.js";

import type {
  Block,
  JsSrc,
  ProvidedSymbolsConfig,
  TranspileError,
  TranspileOptions,
} from "./types.js";
import { fromProvidedSymbolsConfig } from "./definitions.js";

export async function transpileModule(
  ast: Block,
  transpileOptions: TranspileOptions,
  proviedSymbols: ProvidedSymbolsConfig,
): Promise<JsSrc | TranspileError> {
  return await transpileBlock(
    ast,
    EnvF.init(
      fromDefinitions(await fromProvidedSymbolsConfig(proviedSymbols)),
      await State.transpileModule(transpileOptions),
      proviedSymbols.modulePaths,
    ),
  );
}
