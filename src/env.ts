import type { Env, ProvidedSymbolsConfig, TranspileOptions } from "./types.js";

import { init } from "./internal/env.js";
import { transpileString } from "./internal/transpile.js";
import { transpileModule, transpileRepl } from "./internal/transpile-state.js";
import type { TranspileModule, TranspileRepl } from "./internal/types.js";
import { evalString } from "./internal/eval.js";

export async function initializeForModule(
  options: TranspileOptions,
  providedSymbols: ProvidedSymbolsConfig,
): Promise<Env<TranspileModule> | Error> {
  const state = await transpileModule(options);
  const env = init(state, providedSymbols);
  const imports = await transpileString(
    providedSymbols.implicitStatements,
    env,
  );
  if (imports instanceof Error) {
    return imports;
  }
  env.transpileState.importsSrc = imports;
  return env;
}

export async function initializeForRepl(
  options: TranspileOptions,
  providedSymbols: ProvidedSymbolsConfig,
): Promise<Env<TranspileRepl> | Error> {
  const state = await transpileRepl(options);
  const env = init(state, providedSymbols);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const r = await evalString(providedSymbols.implicitStatements, env);
  if (r instanceof Error) {
    return r;
  }
  return env;
}
