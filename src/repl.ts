import { Worker } from "node:worker_threads";
import { Env, TranspileError, TranspileRepl } from "./internal/types.js";
import * as EnvF from "./internal/env.js";

import { implicitlyImporting } from "./provided-symbols-config.js";
import {
  defaultTranspileOptions,
  FilePath,
  Form,
  ProvidedSymbolsConfig,
  TranspileOptions,
} from "./types.js";
import { transpileRepl } from "./internal/transpile-state.js";
import { evalBlock, evalForm, evalString } from "./internal/eval.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */

// FIXME: How can I resolve the path to the .js file?
//        __filename and import.meta.url points to the .ts file (perhaps by vite).
const worker = new Worker("./dist/src/internal/worker.js");
worker.unref();
let lastContextId = 0;

export class Repl {
  private _contextId = lastContextId++;
  private constructor(private _env: Env<TranspileRepl>) {}

  static async start(options: ReplOptions): Promise<Repl> {
    const { providedSymbols, transpileOptions } = options;
    const newEnv = EnvF.init(
      await transpileRepl(transpileOptions),
      providedSymbols,
    );
    const r = await evalString(providedSymbols.implicitStatements, newEnv);
    if (r instanceof TranspileError) {
      throw r;
    }
    return new this(newEnv);
  }

  static async using<Result>(
    options: ReplOptions,
    f: (repl: Repl) => Promise<Result>,
  ): Promise<Result> {
    const repl = await this.start(options);
    try {
      return await f(repl);
    } finally {
      await repl.exit();
    }
  }

  async evalForm(form: Form): Promise<any | Error> {
    return await evalForm(form, this._env);
  }

  async evalBlock(block: Form[]): Promise<any | Error> {
    return await evalBlock(block, this._env);
  }

  async exit(): Promise<void> {}
}

async function _postCommand(command: Command): Promise<any> {
  worker.postMessage(command);
  return new Promise((resolve) => {
    worker.once("message", (value) => {
      resolve(value);
    });
  });
}

export type Command =
  | InitContextCommand
  | EvalFormCommand
  | EvalBlockCommand
  | DropContextCommand;

export function replOptionsFromProvidedSymbols(
  providedSymbols: ProvidedSymbolsConfig,
): ReplOptions {
  return {
    transpileOptions: defaultTranspileOptions(),
    providedSymbols,
  };
}

type WithContextId = { contextId: ContextId };

export type InitContextCommand = WithContextId &
  ReplOptions & {
    command: "initContext";
  };

export type EvalFormCommand = WithContextId & {
  command: "evalForm";
  form: Form;
};

export type EvalBlockCommand = WithContextId & {
  command: "evalBlock";
  block: Form[];
};

export type DropContextCommand = WithContextId & {
  command: "dropContext";
};

export type ContextId = number;

export type ReplOptions = {
  transpileOptions: TranspileOptions;
  providedSymbols: ProvidedSymbolsConfig;
};

export function replOptionsFromBuiltinModulePath(
  builtinModulePath: FilePath,
): ReplOptions {
  return {
    transpileOptions: defaultTranspileOptions(),
    providedSymbols: implicitlyImporting(builtinModulePath),
  };
}
