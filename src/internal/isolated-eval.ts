import type { Env } from "./types.js";

// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

// _cu$ is the reserved prefix of Custard
export const _cu$eval = async (
  _cu$code: string,
  _cu$env: Env,
): Promise<any> => {
  const _cu$result = eval(_cu$code);
  if (_cu$result instanceof Promise) {
    return await _cu$result;
  }
  return _cu$result;
};
