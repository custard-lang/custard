// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

import { Env } from "./types.js";

// See cu-env.ts for details of the `_CU$` prefix.
export const _cu$eval = async (
  _cu$code: string,
  _cu$lastExpression: string,
  _cu$env: Env,
): Promise<any> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return await eval(
    `async () => {\n${_cu$code}return ${_cu$lastExpression}\n}`,
  )();
};
