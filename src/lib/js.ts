import {
  transpileExpression,
  transpileJoinWithComma,
} from "../internal/transpile.js";
import { markAsDirectWriter } from "../internal/types.js";
import { Env, Form, JsSrc, TranspileError } from "../types.js";
import { transpiling2 } from "./base/common.js";

export const _cu$instanceof = transpiling2(
  (a: JsSrc, b: JsSrc) => `${a} instanceof ${b}`,
);

export const _cu$new = markAsDirectWriter(
  async (
    env: Env,
    klass: Form,
    ...args: Form[]
  ): Promise<JsSrc | TranspileError> => {
    const klassSrc = await transpileExpression(klass, env);
    if (TranspileError.is(klassSrc)) {
      return klassSrc;
    }
    const argsSrc = await transpileJoinWithComma(args, env);
    if (TranspileError.is(argsSrc)) {
      return argsSrc;
    }
    return `new (${klassSrc})(${argsSrc})`;
  },
);
