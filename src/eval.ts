import * as vm from "node:vm";
import type { RunningScriptOptions } from "node:vm";

import { Block, Env, Form, TranspileRepl } from "./types.js";
import { transpileStatement, transpileBlock } from "./transpile.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

function createVmOptions({
  srcPath,
  src,
}: TranspileRepl): RunningScriptOptions {
  return {
    // NOTE: importModuleDynamically is not declared in node/vm.d.ts.
    importModuleDynamically: async (specifier: string): Promise<any> => {
      console.log(specifier);
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      const result = await import(specifier);
      console.log(result);
      return result;
    },
    filename: src.isDirectory() ? `${srcPath}/(custard repl)` : srcPath,
  } as RunningScriptOptions;
}

export async function evalForm(
  ast: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileStatement(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  console.log(jsSrc);
  return await vm.runInContext(jsSrc, env.o.vmContext, createVmOptions(env.o));
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileBlock(forms, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }

  console.log(jsSrc);
  return await vm.runInContext(jsSrc, env.o.vmContext, createVmOptions(env.o));
}
