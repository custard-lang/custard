// NOTE: @types/node doesn't support the Promise API as of writing this
//import * as readline from "node:readline/promises";
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

// READ
function read(str: string): any {
  // TODO
  return str;
}

// EVAL
function evalMal(ast: any, _env?: any): any {
  // TODO
  return ast;
}

// PRINT
function print(exp: any): string {
  // TODO
  return exp;
}

function repl(str: string): string {
  // TODO
  return print(evalMal(read(str)));
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
