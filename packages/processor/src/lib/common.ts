import {
  type Id,
  defaultAsyncScopeOptions,
  type Env,
  type Form,
  type TranspileError,
} from "../internal/types.js";
import { type JsSrc, type Ktvals } from "../types.js";
import { buildFn } from "./base/common.js";

export async function buildAsyncFn(
  formId: Id,
  env: Env,
  name: Form | undefined | null,
  argsOrFirstForm: Form | undefined,
  block: Form[],
): Promise<Ktvals<JsSrc> | TranspileError> {
  return await buildFn(
    formId,
    env,
    name,
    argsOrFirstForm,
    block,
    defaultAsyncScopeOptions,
    "async function",
  );
}
