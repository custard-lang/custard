#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const n = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

(async () => {
  // Uncomment this to confirm that the any `await` makes readline drop the input.
  // await new Promise((resolve) => { setTimeout(resolve, 0); });
  try {
    for (let i = 0; i < n; i++) {
      console.log(`Receiving ${i}`);
      const answer = await rl.question(`prompt:${i}:>>> `);
      console.log(answer);
    }
  } finally {
    rl.close();
    input.destroy();
  }
})();
