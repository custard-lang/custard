import { transpileBlock, transpileString } from "./internal/transpile.js";
import * as State from "./internal/transpile-state.js";
import * as EnvF from "./internal/env.js";

import type {
  Block,
  JsSrc,
  ProvidedSymbolsConfig,
  TranspileOptions,
} from "./types.js";
import { TranspileError } from "./types.js";

export async function transpileModule(
  ast: Block,
  transpileOptions: TranspileOptions,
  providedSymbols: ProvidedSymbolsConfig,
  extraOptions: { mayHaveResult: boolean; } = { mayHaveResult: false },
): Promise<JsSrc | TranspileError> {
  const env = EnvF.init(
    await State.transpileModule(transpileOptions),
    providedSymbols,
  );
  const r0 = await transpileString(providedSymbols.implicitStatements, env);
  if (r0 instanceof Error) {
    return r0;
  }
  const r1 = await transpileBlock(ast, env, extraOptions);
  if (r1 instanceof TranspileError) {
    return r1;
  }
  return `${r0.imports}\n${r1.imports}\n${r1.body}`;
}
