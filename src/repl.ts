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

export class Repl {
  private readonly _worker: Worker;

  private constructor() {
    // FIXME: How can I resolve the path to the .js file?
    //        __filename points to the .ts file (perhaps by vite).
    this._worker = new Worker("./dist/src/internal/worker.js");
  }

  static async start(options: ReplOptions): Promise<Repl> {
    const instance = new this();
    instance._worker.postMessage({
      command: "init",
      ...options,
    });

    await instance._awaitResponse();
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

  async sendEvalCommand(command: EvalCommand): Promise<any | Error> {
    this._worker.postMessage(command);
    return this._awaitResponse();
  }

  async exit(): Promise<void> {
    await this._worker.terminate();
  }

  private async _awaitResponse(): Promise<any> {
    return new Promise((resolve) => {
      this._worker.once("message", (value) => {
        resolve(value);
      });
    });
  }
}

export type Command = InitCommand | EvalCommand;

export type EvalCommand = EvalFormCommand | EvalBlockCommand;

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

export function replOptionsFromProvidedSymbols(
  providedSymbols: ProvidedSymbolsConfig,
): ReplOptions {
  return {
    transpileOptions: defaultTranspileOptions(),
    providedSymbols,
  };
}

export type InitCommand = ReplOptions & {
  command: "init";
};

export type EvalFormCommand = {
  command: "evalForm";
  form: Form;
};

export type EvalBlockCommand = {
  command: "evalBlock";
  block: Form[];
};
