import type {
  Env,
  CompleteProvidedSymbolsConfig,
  TranspileOptions,
} from "./types.js";

import { init, readerInputOf } from "./internal/env.js";

import { transpileString } from "./internal/transpile.js";
import { transpileModule, transpileRepl } from "./internal/transpile-state.js";
import type { TranspileModule, TranspileRepl } from "./internal/types.js";
import { evalString } from "./internal/eval.js";
export { readerInputOf } from "./internal/env.js";

export async function initializeForModule(
  options: TranspileOptions,
  providedSymbols: CompleteProvidedSymbolsConfig,
): Promise<Env<TranspileModule> | Error> {
  const state = transpileModule(options);
  const env = init(state, providedSymbols);
  const imports = await transpileString(
    readerInputOf(env, providedSymbols.implicitStatements),
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
  providedSymbols: CompleteProvidedSymbolsConfig,
): Promise<Env<TranspileRepl> | Error> {
  const state = transpileRepl(options);
  const env = init(state, providedSymbols);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const r = await evalString(
    readerInputOf(env, providedSymbols.implicitStatements),
    env,
  );
  if (r instanceof Error) {
    return r;
  }
  return env;
}
