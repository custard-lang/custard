import type { Env, JsSrc } from "../types";
import { writeDebugOut } from "../util/debug";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

export async function __cu$evalJs(
  __cu$src: JsSrc,
  __cu$env: Env,
): Promise<any | Error> {
  try {
    writeDebugOut(__cu$src);
    const __cu$result = eval(__cu$src);
    if (__cu$result instanceof Promise) {
      return await __cu$result;
    } else {
      return __cu$result;
    }
  } catch (__cu$error) {
    console.error(__cu$error);
    return __cu$error;
  }
}
