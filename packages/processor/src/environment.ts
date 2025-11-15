import fs from "node:fs/promises";

import * as ContextF from "./context.js";
import { evalBlock } from "./eval.js";
import { readBlock } from "./reader.js";
import {
  type Context,
  type Environment,
  type FilePathAndStat,
  type FilePath,
  type ProvidedSymbolsConfig,
  type TranspileOptions,
  type TranspileRepl,
  type TranspileState,
  readerInput,
} from "./types.js";
import { assertNonNull } from "./util/error.js";

export async function loadAll(
  srcPaths: [FilePathAndStat, ...FilePathAndStat[]],
  providedSymbols: ProvidedSymbolsConfig,
  providedSymbolsPath: FilePath,
): Promise<Environment<TranspileRepl> | Error> {
  const c = new Map<FilePath, Context<TranspileRepl>>();
  let f = srcPaths[0].path;
  for (const srcPath of srcPaths) {
    const newEnv = await loadToSwitchContextSub(
      c,
      { src: srcPath },
      providedSymbols,
      providedSymbolsPath,
    );
    if (newEnv instanceof Error) {
      return newEnv;
    }
    f = srcPath.path;
  }
  return { c, f };
}

export async function loadToSwitchContext(
  env: Environment<TranspileRepl>,
  { src }: Omit<TranspileOptions, "runtimeModuleEmission">,
  providedSymbols: ProvidedSymbolsConfig,
  providedSymbolsPath: FilePath,
): Promise<Environment<TranspileRepl> | Error> {
  const r = await loadToSwitchContextSub(
    env.c,
    { src },
    providedSymbols,
    providedSymbolsPath,
  );
  if (r instanceof Error) {
    return r;
  }
  return {
    ...env,
    f: src.path,
  };
}

async function loadToSwitchContextSub(
  contextMap: Map<FilePath, Context<TranspileRepl>>,
  { src }: Omit<TranspileOptions, "runtimeModuleEmission">,
  providedSymbols: ProvidedSymbolsConfig,
  providedSymbolsPath: FilePath,
): Promise<undefined | Error> {
  const newContext = await ContextF.initializeForRepl(
    { src },
    providedSymbols,
    providedSymbolsPath,
  );
  if (newContext instanceof Error) {
    return newContext;
  }

  if (!src.isDirectory) {
    try {
      const srcContents = await fs.readFile(src.path, "utf-8");
      const block = readBlock(readerInput(src, srcContents));
      if (block instanceof Error) {
        return block;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await evalBlock(block, newContext);
      if (result instanceof Error) {
        return result;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Error evaluating file ${src.path}:`);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  contextMap.set(src.path, newContext);
}

export function getCurrentContext<S extends TranspileState>({
  c,
  f,
}: Environment<S>): Context<S> {
  return assertNonNull(
    c.get(f),
    `Assertion failure: No context found for file ${f}.`,
  );
}
