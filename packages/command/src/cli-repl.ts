#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  readStr,
  Env,
  Form,
  ParseError,
  evalForm,
  standardModuleRoot,
  defaultTranspileOptions,
  TranspileRepl,
  initializeForRepl,
  implicitlyImporting,
  readerInputOf,
} from "@custard-lang/processor";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

const rl = readline.createInterface({ input, output });

// READ
function read(str: string, env: Env): Form | ParseError {
  return readStr(readerInputOf(env, str));
}

// EVAL
async function evalCustard(ast: Form, env: Env<TranspileRepl>): Promise<any> {
  return await evalForm(ast, env);
}

// PRINT: TODO
//function print(exp: any): string {
//}

async function readEvaluatePrint(
  str: string,
  env: Env<TranspileRepl>,
): Promise<void> {
  const r0 = read(str, env);
  if (ParseError.is(r0)) {
    console.error(r0);
    return;
  }
  console.log(await evalCustard(r0, env));
}

function finalize() {
  rl.close();
  input.destroy();
}

async function loop(env: Env<TranspileRepl>): Promise<void> {
  try {
    while (true) {
      const answer = await rl.question("custard> ");
      if (!answer) {
        finalize();
        break;
      }
      await readEvaluatePrint(answer, env);
    }
  } catch (err) {
    finalize();
    throw err;
  }
}

export function assertNonError<T>(v: T | Error): T {
  if (v instanceof Error) {
    throw v;
  }
  return v;
}

(async () => {
  await loop(
    assertNonError(
      await initializeForRepl(defaultTranspileOptions(), {
        from: process.cwd(),
        ...implicitlyImporting(`${standardModuleRoot}/base.js`),
      }),
    ),
  );
})();
