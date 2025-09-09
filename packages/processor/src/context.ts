import type {
  Context,
  ProvidedSymbolsConfig,
  TranspileOptions,
  TranspileModule,
  TranspileRepl,
  FilePath,
} from "./types.js";
import { assumeIsFile, TranspileError } from "./types.js";

import { init, readerInputOf } from "./internal/context.js";

import { transpileString } from "./internal/transpile.js";
import { transpileModule, transpileRepl } from "./internal/transpile-state.js";
import { evalString } from "./eval.js";

import { evalKtvals } from "./internal/ktvals.js";
export {
  readerInputOf,
  replPromptPrefixOfNormalizedPath,
} from "./internal/context.js";

export async function initializeForModule(
  options: TranspileOptions,
  providedSymbols: ProvidedSymbolsConfig,
  providedSymbolsPath: FilePath,
): Promise<Context<TranspileModule> | Error> {
  const state = transpileModule(options);
  const context = init(
    state,
    providedSymbols,
    assumeIsFile(providedSymbolsPath),
  );
  if (context instanceof TranspileError) {
    return context;
  }
  const implicitInput = readerInputOf(
    context,
    providedSymbols.implicitStatements,
  );
  if (TranspileError.is(implicitInput)) {
    return implicitInput;
  }
  const imports = await transpileString(implicitInput, context);
  if (TranspileError.is(imports)) {
    return imports;
  }
  context.transpileState.importsSrc = imports;
  await evalKtvals(imports, [], context);
  return context;
}

export async function initializeForRepl(
  options: TranspileOptions,
  providedSymbols: ProvidedSymbolsConfig,
  providedSymbolsPath: FilePath,
): Promise<Context<TranspileRepl> | Error> {
  const state = transpileRepl(options);
  const context = init(
    state,
    providedSymbols,
    assumeIsFile(providedSymbolsPath),
  );
  if (context instanceof TranspileError) {
    return context;
  }
  const input = readerInputOf(context, providedSymbols.implicitStatements);
  if (TranspileError.is(input)) {
    return input;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const r = await evalString(input, context);
  if (r instanceof Error) {
    return r;
  }

  return context;
}
