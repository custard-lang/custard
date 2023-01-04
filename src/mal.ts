// NOTE: @types/node doesn't support the Promise API as of writing this
//import * as readline from "node:readline/promises";
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { readStr } from "./reader.js";
import { Form } from "./types.js";
import { ParseError } from "./grammar.js";
import { prStr } from "./printer.js";
import * as Env from "./env.js";
import { evalForm } from "./eval.js";
import { base } from "./lib/base.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument*/

const rl = readline.createInterface({ input, output });

// READ
function read(str: string): Form | ParseError {
  return readStr(str);
}

// EVAL
async function evalCustard(ast: Form): Promise<any> {
  return evalForm(ast, await Env.init(base()));
}

// PRINT
function print(exp: any): string {
  return prStr(exp);
}

function repl(str: string) {
  const r0 = read(str);
  if (r0 instanceof Error) {
    throw r0;
  }
  console.log(print(evalCustard(r0)));
}

function finalize() {
  rl.close();
  input.destroy();
}

function loop() {
  rl.question("custard> ", (answer) => {
    try {
      repl(answer);
    } catch (err) {
      finalize();
      throw err;
    }
    if (!answer) {
      finalize();
      return;
    }
    loop();
  });
}
loop();
