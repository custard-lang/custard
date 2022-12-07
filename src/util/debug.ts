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
const DEBUG_LOG_PATH = process.env.CUSTARD_DEBUG_LOG_PATH;

export function writeDebugOut(s: string) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  appendFileSync(DEBUG_LOG_PATH!, `${s}\n`);
}

export function prDebugOut<T>(x: T): T {
  writeDebugOut(JSON.stringify(x));
  return x;
}

if (DEBUG_LOG_PATH) {
  writeFileSync(DEBUG_LOG_PATH, "");
}
