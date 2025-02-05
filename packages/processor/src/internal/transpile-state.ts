import { type TranspileOptions } from "../types.js";
import type {
  TranspileModule,
  TranspileRepl,
  TranspileStateCore,
} from "./types.js";

function transpileStateCore(): TranspileStateCore {
  return {
    transpiledSrc: [],
    evaluatedUpTo: 0,
    currentBlockIndex: 0,
    lastEvaluationResult: undefined,
    topLevelValues: new Map(),
  };
}

// In REPL without loading any file, use current directory as `srcPath`.
export function transpileRepl(options: TranspileOptions): TranspileRepl {
  return {
    ...options,
    ...transpileStateCore(),
    mode: "repl",
  };
}

export function transpileModule(options: TranspileOptions): TranspileModule {
  return {
    ...options,
    ...transpileStateCore(),
    mode: "module",
    importsSrc: [],
  };
}

export function clearTranspiledSrc(state: TranspileStateCore): void {
  state.transpiledSrc = [];
  state.evaluatedUpTo = 0;
}
