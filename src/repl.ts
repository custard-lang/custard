import { Worker } from "node:worker_threads";

import {
  defaultTranspileOptions,
  FilePath,
  Form,
  ProvidedSymbolsConfig,
  provideNoModules,
  TranspileOptions,
} from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

// FIXME: How can I resolve the path to the .js file?
//        __filename points to the .ts file (perhaps by vite).
const worker = new Worker("./dist/src/internal/worker.js");
let lastContextId = 0;

export class Repl {
  private _contextId = lastContextId++;
  private constructor() {
    // All properties are filled. Nothing to do.
  }

  static async start(options: ReplOptions): Promise<Repl> {
    const instance = new this();

    const r = await _postCommand({
      command: "initContext",
      contextId: instance._contextId,
      ...options,
    });
    if (r instanceof Error){
      throw r;
    }

    return instance;
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
    return await _postCommand({
      command: "evalForm",
      contextId: this._contextId,
      form,
    });
  }

  async evalBlock(block: Form[]): Promise<any | Error> {
    return await _postCommand({
      command: "evalBlock",
      contextId: this._contextId,
      block,
    });
  }

  async exit(): Promise<void> {
    const r = await _postCommand({ command: "dropContext", contextId: this._contextId });
    if (r instanceof Error){
      throw r;
    }
  }
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
    providedSymbols: provideNoModules(builtinModulePath),
  };
}
