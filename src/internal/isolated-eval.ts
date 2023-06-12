// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

import { CU_ENV } from "./cu-env.js";
import { Env } from "./types.js";

// See cu-env.ts for details of the `_CU$` prefix.
export const _cu$eval = async (
  code: string,
  lastExpression: string,
  env: Env,
): Promise<any> => {
  // https://gist.github.com/tomhodgins/0e5a98610a1da2a98049614a4f170734
  const f = `export default async (${CU_ENV}) => {\n${code}return ${lastExpression}\n}`;
  const mod = await import(
    `data:application/javascript,${encodeURIComponent(f)}`
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,  @typescript-eslint/no-unsafe-member-access
  return await mod.default(env);
};
