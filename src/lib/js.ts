import {
  transpileExpression,
  transpileJoinWithComma,
} from "../internal/transpile.js";
import type { Env, Form, JsSrc } from "../types.js";
import {
  markAsDirectWriter,
  markAsDynamicVar,
  TranspileError,
} from "../types.js";
import { transpiling2 } from "./base/common.js";

export const _cu$null = markAsDynamicVar(() => "null");

export const _cu$undefined = markAsDynamicVar(() => "void 0");

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
