import {
  transpileExpression,
  transpileJoinWithComma,
} from "../internal/transpile.js";
import type { Env, Form, JsSrc, Ktvals } from "../types.js";
import {
  markAsDirectWriter,
  markAsDynamicVar,
  TranspileError,
  ktvalOther,
} from "../types.js";
import { transpiling2 } from "./base/common.js";

export const _cu$null = markAsDynamicVar(() => [ktvalOther("null")]);

export const _cu$undefined = markAsDynamicVar(() => [ktvalOther("void 0")]);

export const _cu$instanceof = transpiling2(
  "js.instanceof",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [
    ...a,
    ktvalOther(" instanceof "),
    ...b,
  ],
);

export const _cu$new = markAsDirectWriter(
  async (
    env: Env,
    klass?: Form,
    ...args: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (klass === undefined) {
      return new TranspileError("`new` must be followed by an expression!");
    }

    const klassSrc = await transpileExpression(klass, env);
    if (TranspileError.is(klassSrc)) {
      return klassSrc;
    }
    const argsSrc = await transpileJoinWithComma(args, env);
    if (TranspileError.is(argsSrc)) {
      return argsSrc;
    }
    return [
      ktvalOther("new ("),
      ...klassSrc,
      ktvalOther(")("),
      ...argsSrc,
      ktvalOther(")"),
    ];
  },
);
