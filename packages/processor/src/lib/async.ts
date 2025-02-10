import * as EnvF from "../internal/env.js";
import {
  defaultAsyncScopeOptions,
  ordinaryStatement,
} from "../internal/types.js";
import {
  type Env,
  type Form,
  type JsSrc,
  type Ktvals,
  ktvalOther,
  markAsDirectWriter,
  TranspileError,
} from "../types.js";
import {
  buildAsyncFn,
  buildFn,
  buildForEach,
  buildProcedure,
  buildScope,
  transpiling1Unmarked,
} from "./internal.js";

export const _cu$await = markAsDirectWriter(
  async (env: Env, a: Form, ...unused: Form[]) => {
    if (!EnvF.isInAsyncContext(env)) {
      return new TranspileError(
        "`async.await` in a non-async function or scope is not allowed.",
      );
    }
    return await transpiling1Unmarked("await", (s: Ktvals<JsSrc>) => [
      ktvalOther("await "),
      ...s,
    ])(env, a, ...unused);
  },
);

export const fn = markAsDirectWriter(
  async (
    env: Env,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildAsyncFn(
      "async.fn",
      env,
      nameOrArgs,
      argsOrFirstForm,
      block,
    );
  },
);

export const procedure = markAsDirectWriter(
  async (
    env: Env,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildProcedure(
      "async.procedure",
      env,
      nameOrArgs,
      argsOrFirstForm,
      block,
      defaultAsyncScopeOptions,
      "async function",
    );
  },
);

export const generatorFn = markAsDirectWriter(
  async (
    env: Env,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildFn(
      "async.generatorFn",
      env,
      nameOrArgs,
      argsOrFirstForm,
      block,
      { isAsync: true, isGenerator: true },
      "async function*",
    );
  },
);

export const generatorProcedure = markAsDirectWriter(
  async (
    env: Env,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildProcedure(
      "async.generatorProcedure",
      env,
      nameOrArgs,
      argsOrFirstForm,
      block,
      { isAsync: true, isGenerator: true },
      "async function*",
    );
  },
);

export const scope = buildScope(
  "scope",
  "async function",
  defaultAsyncScopeOptions,
);

export const forEach = markAsDirectWriter(
  async (
    env: Env,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (!EnvF.isInAsyncContext(env)) {
      return new TranspileError(
        "`async.forEach` in a non-async function or scope is not allowed.",
      );
    }
    return await buildForEach(
      (
        assignee: JsSrc,
        iterableSrc: Ktvals<JsSrc>,
        statementsSrc: Ktvals<JsSrc>,
      ): Ktvals<JsSrc> => [
        ktvalOther(`for await (const ${assignee} of `),
        ...iterableSrc,
        ktvalOther("){"),
        ...statementsSrc,
        ktvalOther("}"),
      ],
    )(env, ...forms);
  },
  ordinaryStatement,
);
