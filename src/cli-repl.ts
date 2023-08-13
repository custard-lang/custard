#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { readStr } from "./reader.js";
import { Form } from "./types.js";
import { ParseError } from "./grammar.js";
import { prStr } from "./printer.js";
import { evalForm } from "./eval.js";
import { Repl, replOptionsFromBuiltinModulePath } from "./repl.js";
import { standardModuleRoot } from "./definitions.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

const rl = readline.createInterface({ input, output });

// READ
function read(str: string): Form | ParseError {
  return readStr(str);
}

// EVAL
async function evalCustard(ast: Form, repl: Repl): Promise<any> {
  return await evalForm(ast, repl);
}

// PRINT
function print(exp: any): string {
  if (exp instanceof Error) {
    console.error(exp);
    return "";
  }
  return prStr(exp);
}

async function readEvaluatePrint(str: string, repl: Repl): Promise<void> {
  const r0 = read(str);
  if (ParseError.is(r0)) {
    console.error(r0);
    return;
  }
  console.log(print(await evalCustard(r0, repl)));
}

function finalize() {
  rl.close();
  input.destroy();
}

async function loop(repl: Repl): Promise<void> {
  try {
    while (true) {
      const answer = await rl.question("custard> ");
      if (!answer) {
        finalize();
        break;
      }
      await readEvaluatePrint(answer, repl);
    }
  } catch (err) {
    finalize();
    throw err;
  }
}

// I don't need top-level `await` here!
// eslint-disable-next-line @typescript-eslint/no-floating-promises
Repl.using(
  replOptionsFromBuiltinModulePath(`${standardModuleRoot}/base.js`),
  loop,
);
