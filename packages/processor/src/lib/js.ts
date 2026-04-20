import {
  transpileExpressionsJoinWithCommaU,
  transpileExpressionU,
} from "../internal/transpile.js";
import type { Context, JsSrc, Ktvals } from "../types.js";
import {
  markAsDirectWriter,
  markAsDynamicVar,
  TranspileError,
  ktvalOther,
} from "../types.js";

import { transpiling2 } from "./internal.js";

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
    context: Context,
    klass?: unknown,
    ...args: unknown[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (klass === undefined) {
      return new TranspileError("`new` must be followed by an expression!");
    }

    const klassSrc = await transpileExpressionU(klass, context);
    if (TranspileError.is(klassSrc)) {
      return klassSrc;
    }
    const argsSrc = await transpileExpressionsJoinWithCommaU(args, context);
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
