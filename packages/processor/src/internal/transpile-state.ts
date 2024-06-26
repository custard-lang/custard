import { type TranspileOptions } from "../types.js";
import { type TranspileModule, type TranspileRepl } from "./types.js";

// In REPL without loading any file, use current directory as `srcPath`.
export function transpileRepl(options: TranspileOptions): TranspileRepl {
  return {
    ...options,
    mode: "repl",
    topLevelValues: new Map(),
  };
}

export function transpileModule(options: TranspileOptions): TranspileModule {
  return {
    ...options,
    mode: "module",
    importsSrc: "",
  };
}
