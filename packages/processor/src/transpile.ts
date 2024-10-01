import type {
  Block,
  JsSrc,
  CompleteProvidedSymbolsConfig,
  TranspileOptions,
} from "./types.js";
import { TranspileError } from "./types.js";

import { transpileBlock } from "./internal/transpile.js";
import { initializeForModule } from "./env.js";

export async function transpileModule(
  ast: Block,
  transpileOptions: TranspileOptions,
  providedSymbols: CompleteProvidedSymbolsConfig,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<JsSrc | Error> {
  const env = await initializeForModule(transpileOptions, providedSymbols);
  if (env instanceof Error) {
    return env;
  }

  const r = await transpileBlock(ast, env, extraOptions);
  if (TranspileError.is(r)) {
    return r;
  }
  return `${env.transpileState.importsSrc}\n${r}`;
}
