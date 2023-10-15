// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

import { evalModule } from "../util/eval.js";

import { CU_ENV } from "./cu-env.js";
import { Env, JsSrc } from "./types.js";

// See cu-env.ts for details of the `_CU$` prefix.
export const _cu$eval = async (
  body: JsSrc,
  lastExpression: JsSrc,
  env: Env,
): Promise<any> => {
  // https://gist.github.com/tomhodgins/0e5a98610a1da2a98049614a4f170734
  let f = `export default async (${CU_ENV}) => {${body}`;
  if (lastExpression !== "") {
    f = `${f}return ${lastExpression}`;
  }
  f = `${f}}`;
  // console.log(f);
  const mod = await evalModule(f);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,  @typescript-eslint/no-unsafe-member-access
  return await mod.default(env);
};
