#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

(async () => {
  try {
    console.log("Receiving 1");
    console.log(await rl.question("prompt:1:>>> "));

    console.log("Receiving 2");
    console.log(await rl.question("prompt:2:>>> "));

    console.log("Receiving 3");
    console.log(await rl.question("prompt:3:>>> "));
  } finally {
    rl.close();
    input.destroy();
  }
})();
