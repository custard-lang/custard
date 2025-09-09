import type {
  Block,
  FilePath,
  FilePathAndStat,
  JsSrc,
  ProvidedSymbolsConfig,
  TranspileOptions,
} from "./types.js";
import { TranspileError } from "./types.js";

import { transpileBlock } from "./internal/transpile.js";
import { initializeForModule } from "./context.js";
import { clearTranspiledSrc } from "./internal/transpile-state.js";
import { transpileKtvalsForModule } from "./internal/ktvals.js";

export async function transpileModule(
  ast: Block,
  transpileOptions: TranspileOptions,
  providedSymbols: ProvidedSymbolsConfig,
  providedSymbolsPath: FilePath,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<JsSrc | Error> {
  const context = await initializeForModule(
    transpileOptions,
    providedSymbols,
    providedSymbolsPath,
  );
  if (context instanceof Error) {
    return context;
  }

  const r = await transpileBlock(ast, context, extraOptions);
  if (TranspileError.is(r)) {
    return r;
  }
  clearTranspiledSrc(context.transpileState);
  const importsJs = transpileKtvalsForModule(
    context.transpileState.importsSrc,
    context,
  );
  const blockJs = transpileKtvalsForModule(r, context);
  return `${importsJs}\n${blockJs}`;
}
