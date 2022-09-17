import { appendFileSync, writeFileSync } from "node:fs";

export function pr<T>(x: T): T {
  console.log(x);
  return x;
}

// Used when console.log doesn't help when running tests.
const DEBUG_LOG_PATH = process.env.CUSTARD_DEBUG_LOG_PATH;

export function writeDebugOut(s: string) {
  appendFileSync(DEBUG_LOG_PATH!, `${s}\n`);
}

export function prDebugOut<T>(x: T): T {
  writeDebugOut(JSON.stringify(x));
  return x;
}

if (DEBUG_LOG_PATH) {
  writeFileSync(DEBUG_LOG_PATH, "");
}
