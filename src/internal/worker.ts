import { parentPort } from "node:worker_threads";

import { expectNever } from "../util/error.js";

import { fromDefinitions } from "./scope.js";
import * as EnvF from "./env.js";
import type { Command, ContextId } from "../repl.js";
import { transpileRepl } from "./transpile-state.js";

import type { Env, TranspileRepl } from "./types.js";
import { TranspileError } from "./types.js";
import { evalBlock, evalForm, evalString } from "./eval.js";

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment */

const envs: Map<ContextId, Env<TranspileRepl>> = new Map();

// Event handler as a Promise doesn't have to be awaited!
/* eslint-disable-next-line @typescript-eslint/no-misused-promises */
parentPort!.on("message", async (message: Command) => {
  try {
    switch (message.command) {
      case "initContext":
        const { providedSymbols, contextId, transpileOptions } = message;
        const newEnv = EnvF.init(
          await transpileRepl(transpileOptions),
          providedSymbols,
        );
        const rI = await evalString(providedSymbols.implicitStatements, newEnv);
        if (rI instanceof TranspileError) {
          parentPort!.postMessage(rI);
        } else {
          envs.set(contextId, newEnv);
          parentPort!.postMessage(null);
        }
        break;
      case "evalForm":
        // TODO: Implement our custom serializer so that postMessage can transfer.
        const rF = await evalForm(message.form, envs.get(message.contextId)!);
        parentPort!.postMessage(rF);
        break;
      case "evalBlock":
        // TODO: Implement our custom serializer so that postMessage can transfer.
        const rB = await evalBlock(message.block, envs.get(message.contextId)!);
        parentPort!.postMessage(rB);
        break;
      case "dropContext":
        const rd = envs.delete(message.contextId);
        if (!rd) {
          console.error("Failed to delete contextId", message.contextId);
        }
        parentPort!.postMessage(null);
        break;
      default:
        console.error("Unknown command", message);
        expectNever(message);
    }
  } catch (e) {
    parentPort!.postMessage(e);
  }
});
