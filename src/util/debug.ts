import { threadId } from "node:worker_threads";
import { appendFileSync, writeFileSync } from "node:fs";

export function pr<T>(x: T, ...msgs: unknown[]): T {
  if (msgs.length > 0) {
    console.log(...[...msgs, x]);
  } else {
    console.log(x);
  }
  return x;
}

// Used when console.log doesn't help when running tests.
const DEBUG_LOG_PREFIX = process.env.CUSTARD_DEBUG_LOG_PREFIX;
const DEBUG_LOG_PATH = DEBUG_LOG_PREFIX && `${DEBUG_LOG_PREFIX}${threadId}.log`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function writeDebugOut<T>(x: T): T {
  if (DEBUG_LOG_PATH) {
    // TODO: Implement our custom serializer
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    appendFileSync(DEBUG_LOG_PATH, `${x}\n`);
  }
  return x;
}

export function prDebugOut<T>(x: T, label = ""): T {
  writeDebugOut(`${label}${JSON.stringify(x)}`);
  return x;
}

if (DEBUG_LOG_PATH) {
  writeFileSync(DEBUG_LOG_PATH, "");
}
