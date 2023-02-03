import { Worker } from "node:worker_threads";

import {
  defaultTranspileOptions,
  Form,
  ProvidedSymbols,
  provideNoModules,
  Scope,
  TranspileOptions,
} from "./types";

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
    return new Promise((resolve) => {
      this._worker.once("message", (value) => {
        resolve(value);
      });
    });
  }

  async exit(): Promise<void> {
    await this._worker.terminate();
  }
}

export type Command = InitCommand | EvalCommand;

export type EvalCommand = EvalFormCommand | EvalBlockCommand;

export type ReplOptions = {
  transpileOptions: TranspileOptions;
  providedSymbols: ProvidedSymbols;
};

export function replOptionsFromInitialScope(initialScope: Scope): ReplOptions {
  return {
    transpileOptions: defaultTranspileOptions(),
    providedSymbols: provideNoModules(initialScope),
  };
}

export function replOptionsFromProvidedSymbols(
  providedSymbols: ProvidedSymbols,
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
