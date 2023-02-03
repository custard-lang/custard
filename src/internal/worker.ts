import { parentPort } from "node:worker_threads";
import * as EnvF from "./env.js";
import type { Command } from "../repl.js";
import { transpileRepl } from "./transpile-state.js";

import type { Env, TranspileRepl } from "./types.js";
import { evalBlock, evalForm } from "./eval.js";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

// Context is referred in the `eval`ed script.
let env: Env<TranspileRepl> | undefined;

parentPort!.on("message", async (message: Command) => {
  switch (message.command) {
    case "init":
      const initMessage = message;
      env = await EnvF.init(
        initMessage.providedSymbols.initialScope,
        await transpileRepl(message.transpileOptions),
        initMessage.providedSymbols.modulePaths,
      );
      break;
    case "evalForm":
      const rF = await evalForm(message.form, env!);
      parentPort!.postMessage(rF);
      break;
    case "evalBlock":
      const rB = await evalBlock(message.block, env!);
      parentPort!.postMessage(rB);
      break;
    default:
      console.error("Unknown command", message);
  }
});
