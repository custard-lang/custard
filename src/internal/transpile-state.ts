import { stat } from "node:fs/promises";

import { TranspileOptions } from "../types.js";
import { TranspileModule, TranspileRepl } from "./types.js";

// In REPL without loading any file, use current directory as `srcPath`.
export async function transpileRepl(
  options: TranspileOptions,
): Promise<TranspileRepl> {
  return {
    ...options,
    mode: "repl",
    src: await stat(options.srcPath),
    topLevelValues: new Map(),
  };
}

export async function transpileModule(
  options: TranspileOptions,
): Promise<TranspileModule> {
  return { ...options, mode: "module", src: await stat(options.srcPath) };
}
