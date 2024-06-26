import * as EnvF from "../internal/env.js";
import {
  defaultAsyncScopeOptions,
  type Env,
  type Form,
  markAsDirectWriter,
  ordinaryStatement,
  TranspileError,
} from "../internal/types.js";
import { type JsSrc } from "../types.js";
import {
  buildFn,
  buildForEach,
  buildProcedure,
  buildScope,
  transpiling1Unmarked,
} from "./base/common.js";

export const _cu$await = markAsDirectWriter(
  async (env: Env, a: Form, ...unused: Form[]) => {
    if (!EnvF.isInAsyncContext(env)) {
      return new TranspileError(
        "`async.await` in a non-async function or scope is not allowed.",
      );
    }
    return await transpiling1Unmarked("await", (s: JsSrc) => `await ${s}`)(
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

export const forEach = markAsDirectWriter(
  async (env: Env, ...forms: Form[]): Promise<JsSrc | TranspileError> => {
    if (!EnvF.isInAsyncContext(env)) {
      return new TranspileError(
        "`async.forEach` in a non-async function or scope is not allowed.",
      );
    }
    return await buildForEach(
      (assignee: JsSrc, iterableSrc: JsSrc, statementsSrc: JsSrc): JsSrc =>
        `for await (const ${assignee} of ${iterableSrc}){${statementsSrc}}`,
    )(env, ...forms);
  },
  ordinaryStatement,
);
