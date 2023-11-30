import * as EnvF from "../internal/env.js";
import {
  defaultAsyncScopeOptions,
  Env,
  Form,
  markAsDirectWriter,
  TranspileError,
} from "../internal/types.js";
import { JsSrc } from "../types.js";
import {
  buildFn,
  buildForEach,
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
    return transpiling1Unmarked("await", (s: JsSrc) => `await ${s}`)(
      env,
      a,
      ...unused,
    );
  },
);

export const fn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildFn(
      "async.fn",
      env,
      args,
      block,
      defaultAsyncScopeOptions,
      "async",
      "=>",
    );
  },
);

export const procedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildProcedure(
      "async.procedure",
      env,
      args,
      block,
      defaultAsyncScopeOptions,
      "async",
      "=>",
    );
  },
);

export const generatorFn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildFn(
      "async.generatorFn",
      env,
      args,
      block,
      { isAsync: true, isGenerator: true },
      "async function*",
      "",
    );
  },
);

export const generatorProcedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildProcedure(
      "async.generatorProcedure",
      env,
      args,
      block,
      { isAsync: true, isGenerator: true },
      "async function*",
      "",
    );
  },
);

export const scope = buildScope("scope", "async ", defaultAsyncScopeOptions);

export const forEach = buildForEach(
  (assignee: JsSrc, iterableSrc: JsSrc, statementsSrc: JsSrc): JsSrc =>
    `for await (const ${assignee} of ${iterableSrc}){${statementsSrc}}`,
);
