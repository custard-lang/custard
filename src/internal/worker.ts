import { parentPort } from "node:worker_threads";
import * as EnvF from "./env.js";
import type { Command } from "../repl.js";
import { transpileRepl } from "./transpile-state.js";

import type { Env, TranspileRepl } from "./types.js";
import { evalBlock, evalForm } from "./eval.js";
import { loadAsScope } from "../module.js";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

let env: Env<TranspileRepl> | undefined;

// Event handler as a Promise doesn't have to be awaited!
/* eslint-disable-next-line @typescript-eslint/no-misused-promises */
parentPort!.on("message", async (message: Command) => {
  switch (message.command) {
    case "init":
      const initMessage = message;
      env = EnvF.init(
        await loadAsScope(initMessage.providedSymbols.builtinModulePaths),
        await transpileRepl(message.transpileOptions),
        initMessage.providedSymbols.modulePaths,
      );
      parentPort!.postMessage(null);
      break;
    case "evalForm":
      // TODO: Implement our custom serializer so that postMessage can transfer.
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      const rF = await evalForm(message.form, env!);
      parentPort!.postMessage(rF);
      break;
    case "evalBlock":
      // TODO: Implement our custom serializer so that postMessage can transfer.
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      const rB = await evalBlock(message.block, env!);
      parentPort!.postMessage(rB);
      break;
    default:
      console.error("Unknown command", message);
  }
});
