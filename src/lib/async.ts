import * as EnvF from "../internal/env.js";
import { extendBody } from "../internal/transpile.js";
import {
  Env,
  Form,
  markAsDirectWriter,
  TranspileError,
} from "../internal/types.js";
import { JsModule } from "../types.js";
import {
  buildFn,
  buildProcedure,
  buildScope,
  transpiling1Unmarked,
} from "./base/common.js";

export const _cu$await = markAsDirectWriter(
  (env: Env, a: Form, ...unused: Form[]) => {
    if (!EnvF.isInAsyncContext(env)) {
      return new TranspileError(
        "`await` in a non-async function or scope is not allowed.",
      );
    }
    return transpiling1Unmarked("await", (s: JsModule) =>
      extendBody(s, "await "),
    )(env, a, ...unused);
  },
);

export const fn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsModule | TranspileError> => {
    const funcSrc = await buildFn(env, "fn", args, block, true);
    if (funcSrc instanceof TranspileError) {
      return funcSrc;
    }
    return extendBody(funcSrc, "async ");
  },
);

export const procedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsModule | TranspileError> => {
    const funcSrc = await buildProcedure(env, "procedure", args, block, true);
    if (funcSrc instanceof TranspileError) {
      return funcSrc;
    }
    return extendBody(funcSrc, "async ");
  },
);

export const scope = buildScope("async ", "scope", true);
