#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { readStr } from "./reader.js";
import { Env, Form } from "./types.js";
import { ParseError } from "./grammar.js";
import { prStr } from "./printer.js";
import { evalForm } from "./eval.js";
import { standardModuleRoot } from "./definitions.js";
import { defaultTranspileOptions, TranspileRepl } from "./internal/types.js";
import { initializeForRepl } from "./env.js";
import { implicitlyImporting } from "./provided-symbols-config.js";
import { assertNonError } from "./util/error.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

const rl = readline.createInterface({ input, output });

// READ
function read(str: string): Form | ParseError {
  return readStr(str);
}

// EVAL
async function evalCustard(ast: Form, env: Env<TranspileRepl>): Promise<any> {
  return await evalForm(ast, env);
}

// PRINT
function print(exp: any): string {
  if (exp instanceof Error) {
    console.error(exp);
    return "";
  }
  return prStr(exp);
}

async function readEvaluatePrint(
  str: string,
  env: Env<TranspileRepl>,
): Promise<void> {
  const r0 = read(str);
  if (ParseError.is(r0)) {
    console.error(r0);
    return;
  }
  console.log(print(await evalCustard(r0, env)));
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

// I don't need top-level `await` here!
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await loop(
    assertNonError(
      await initializeForRepl(
        defaultTranspileOptions(),
        implicitlyImporting(`${standardModuleRoot}/base.js`),
      ),
    ),
  );
})();
