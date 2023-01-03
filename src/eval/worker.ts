// __cu$ is the reserved prefix of Custard
import { parentPort as __cu$parentPort } from "node:worker_threads";

import type { Id } from "../types.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

// __cu$Context is referred in the `eval`ed script.
const __cu$Context = new Map<Id, any>();
void __cu$Context;

__cu$parentPort!.on("message", (message) => {
  void (async () => {
    try {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
      const __cu$result = eval(message);
      if (__cu$result instanceof Promise) {
        __cu$parentPort!.postMessage(await __cu$result);
      } else {
        __cu$parentPort!.postMessage(__cu$result);
      }
    } catch (e) {
      console.error(e);
    }
  })();
});
