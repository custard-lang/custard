// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

import { Env } from "./types";

// Ref. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction/AsyncFunction
// eslint-disable-next-line @typescript-eslint/no-empty-function
const _cu$AsyncFunction: { new(argName: string, code: string): (env: Env) => Promise<any> } = async function () {}.constructor as any;

export const _cu$eval = async (
  code: string,
  lastExpression: string,
  env: Env,
): Promise<any> => {
  // _cu$ is the reserved prefix of Custard
  return await new _cu$AsyncFunction("_cu$env", `${code}return ${lastExpression};`)(env);
};
