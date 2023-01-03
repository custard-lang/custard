import { Worker } from "node:worker_threads";
import { JsSrc } from "../types.js";

// Vitest correctly loads by this path.
const worker = new Worker("./dist/src/eval/worker.js");

export async function evalAsync(src: JsSrc): Promise<any> {
  worker.postMessage(src);
  return new Promise((resolve) => {
    worker.once("message", (value) => {
      resolve(value);
    });
  });
}
