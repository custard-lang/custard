#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

async function ask(lineNumber: number): Promise<string> {
  return await rl.question(`prompt:${lineNumber}:>>> `);
}

async function readEvaluatePrintLoop(): Promise<void> {
  try {
    let lineNumber = 1;
    while (true) {
      const answer = await ask(lineNumber);
      if (answer === ":q" || answer === ":quit") {
        rl.close();
        input.destroy();
        break;
      }
      console.log(answer);
      lineNumber++;
    }
  } catch (err) {
    rl.close();
    input.destroy();
    throw err;
  }
}

async function simulateAsyncInit(): Promise<void> {
  // Simulate some async initialization work
  await new Promise((resolve) => setTimeout(resolve, 0));
}

(async () => {
  await simulateAsyncInit();
  await readEvaluatePrintLoop();
})();
