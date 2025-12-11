import * as ContextF from "../internal/context.js";
import {
  defaultAsyncScopeOptions,
  ordinaryStatement,
} from "../internal/types.js";
import {
  type Context,
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
  async (context: Context, a: Form, ...unused: Form[]) => {
    if (!ContextF.isInAsyncContext(context)) {
      return new TranspileError(
        "`async.await` in a non-async function or scope is not allowed.",
      );
    }
    return await transpiling1Unmarked("await", (s: Ktvals<JsSrc>) => [
      ktvalOther("await "),
      ...s,
    ])(context, a, ...unused);
  },
);

export const fn = markAsDirectWriter(
  async (
    context: Context,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildAsyncFn(
      "async.fn",
      context,
      nameOrArgs,
      argsOrFirstForm,
      block,
    );
  },
);

export const procedure = markAsDirectWriter(
  async (
    context: Context,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildProcedure(
      "async.procedure",
      context,
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
    context: Context,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildFn(
      "async.generatorFn",
      context,
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
    context: Context,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildProcedure(
      "async.generatorProcedure",
      context,
      nameOrArgs,
      argsOrFirstForm,
      block,
      { isAsync: true, isGenerator: true },
      "async function*",
    );
  },
);

// TODO: Create awaitScope
export const scope = buildScope(
  "scope",
  "async function",
  defaultAsyncScopeOptions,
);

export const forEach = markAsDirectWriter(
  async (
    context: Context,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (!ContextF.isInAsyncContext(context)) {
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
    )(context, ...forms);
  },
  ordinaryStatement,
);
