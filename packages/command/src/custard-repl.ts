#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const n = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

(async () => {
  try {
    let i = 0;
    while (true) {
      if (i === n) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      console.log(`Receiving ${i}`);
      const answer = await rl.question(`prompt:${i}:>>> `);
      console.log(answer);
      i++;
    }
  } finally {
    rl.close();
    input.destroy();
  }
})();
