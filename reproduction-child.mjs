#!/usr/bin/env node

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const n = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

function someAsyncComputation(answer) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`Processed: ${answer}`);
    }, 0);
  });
}

let i = 0;

rl.on("line", async (answer) => {
  const result = await someAsyncComputation(answer);
  console.log(result);

  i++;
  if (i < n + 1) {
    console.log(`Receiving ${i}`);
    rl.setPrompt(`prompt:${i}:>>> `);
    rl.prompt();
  } else {
    rl.close();
    input.destroy();
  }
});

console.log(`Receiving ${i}`);
rl.setPrompt(`prompt:${i}:>>> `);
rl.prompt();
