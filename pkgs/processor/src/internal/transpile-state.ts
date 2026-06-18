import { type TranspileOptions } from "../types.js";
import {
  fromDefaultTranspileOptions,
  normalizeSrcPath,
  type TranspileModule,
  type TranspileRepl,
  type TranspileStateCore,
} from "./types.js";

function transpileStateCore(options: TranspileOptions): TranspileStateCore {
  return {
    ...normalizeSrcPath(options),
    transpiledSrc: [],
    evaluatedUpTo: 0,
    currentBlockIndex: 0,
    topLevelValues: new Map(),
  };
}

// In REPL without loading any file, use current directory as `srcPath`.
export function transpileRepl(
  options: Omit<TranspileOptions, "runtimeModuleEmission">,
): TranspileRepl {
  return {
    ...transpileStateCore(fromDefaultTranspileOptions(options)),
    mode: "repl",
  };
}

export function transpileModule(options: TranspileOptions): TranspileModule {
  return {
    ...transpileStateCore(options),
    mode: "module",
    importsSrc: [],
  };
}

export function clearTranspiledSrc(state: TranspileStateCore): void {
  state.transpiledSrc = [];
  state.evaluatedUpTo = 0;
}
