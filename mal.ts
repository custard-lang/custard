// NOTE: @types/node doesn't support the Promise API as of writing this
//import * as readline from "node:readline/promises";
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { readStr } from "./reader";
import { Form } from "./types";
import { ParseError } from "./grammar";
import { prStr } from "./printer";

const rl = readline.createInterface({ input, output });

// READ
function read(str: string): Form | ParseError {
  return readStr(str);
}

// EVAL
function evalMal(ast: Form, _env?: any): any {
  // TODO
  return ast;
}

// PRINT
function print(exp: any): string {
  return prStr(exp);
}

function repl(str: string): string | Error {
  const r0 = read(str);
  if (r0 instanceof Error) {
    return r0;
  }
  return print(evalMal(r0));
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
