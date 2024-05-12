import {
  Env,
  TranspileRepl,
  Block,
  markAsFunctionWithEnv,
  FilePath,
  markAsDirectWriter,
  TranspileError,
  JsSrc,
  Form,
  isUnquote,
  isSplice,
  isLiteralArray,
  isList,
  isLiteralObject,
  Location,
  List,
  LiteralObject,
  LiteralArray,
  Unquote,
  Splice,
} from "../types.js";
import { evalBlock, evalForm } from "../internal/eval.js";
import { srcPathForErrorMessage } from "../internal/env.js";

import { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";

export { transpileModule } from "../transpile.js";
export { cuSymbol as symbol, list } from "../types.js";

export const readString = markAsFunctionWithEnv(
  (
    env: Env,
    contents: string,
    path: FilePath = srcPathForErrorMessage(env),
  ): Block | ParseError => {
    return readBlock({ contents, path });
  },
);

export const evaluate = markAsFunctionWithEnv(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (env: Env, formOrBlock: Form | Block): any | Error => {
    if (env.transpileState.mode === "repl") {
      // Dirty workaround for https://github.com/microsoft/TypeScript/issues/42384
      const env_ = env as Env<TranspileRepl>;
      if (Array.isArray(formOrBlock)) {
        return evalBlock(formOrBlock, env_);
      }
      return evalForm(formOrBlock, env_);
    }
    throw new Error(
      "Sorry, user `evaluate` function is currently only available in `repl` mode",
    );
  },
);

export const quote = markAsDirectWriter(
  async (
    _env: Env,
    ...forms: Block
  ): Promise<JsSrc | TranspileError> => {
    if (forms.length !== 1) {
      return new TranspileError("quote expects exactly one form");
    }
    return JSON.stringify(forms[0]);
  },
);

export const quasiQuote = markAsDirectWriter(
  async (
    env: Env,
    ...forms: Block<Location>
  ): Promise<JsSrc | TranspileError> => {
    const [form] = forms;
    if (forms.length !== 1 || form === undefined) {
      return new TranspileError("quasiQuote expects exactly one form");
    }
    return traverseUnquoting(form, env);
  },
);

function traverseUnquoting(form: Form<Location>, env: Env): JsSrc | TranspileError {
  if (isList(form)) {
    return traverseList(form, env);
  }
  if (isLiteralArray(form)) {
    return traverseLiteralArray(form, env);
  }
  if (isLiteralObject(form)) {
    return traverseLiteralObject(form, env);
  }
  if (isUnquote(form)) {
    return traverseUnquote(form, env);
  }
  if (isSplice(form)) {
    return traverseSplice(form, env);
  }
  return JSON.stringify(form);
}

function traverseList(form: List<Location>, env: Env): JsSrc | TranspileError {
  const elementsSrc = form.v.map((f): JsSrc | TranspileError => traverseUnquoting(f, env)).join(", ")
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  return `{t:"List",v:[${elementsSrc}],l:${form.l},c:${form.c},f:${JSON.stringify(form.f)}}`;
}

function traverseLiteralArray(form: LiteralArray<Location>, env: Env): JsSrc | TranspileError {
  const elementsSrc = form.v.map((f): JsSrc | TranspileError => traverseUnquoting(f, env)).join(", ")
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  return `{t:"Array",v:[${elementsSrc}],l:${form.l},c:${form.c},f:${JSON.stringify(form.f)}}`;
}

function traverseLiteralObject(form: LiteralObject<Location>, env: Env): JsSrc | TranspileError {
  const elementsSrc = form.v.map((f): JsSrc | TranspileError => {
    if (Array.isArray(f)) {
      return `${traverseUnquoting(f[0], env)}:${traverseUnquoting(f[1], env)}`;
    }
    return traverseUnquoting(f, env);
  }).join(", ")
  if (TranspileError.is(elementsSrc)) {
    return elementsSrc;
  }
  return `{t: "Object", v: [${elementsSrc}], l: ${form.l}, c: ${form.c}, f: ${JSON.stringify(form.f)}}`;
}

// TODO: Error if not in an unquote
function traverseUnquote(form: Unquote<Location>, env: Env): JsSrc | TranspileError {
}

// TODO: Error if not in a list, array or object
function traverseSplice(form: Splice<Location>, env: Env): JsSrc | TranspileError {
  return `...${traverseUnquoting(form.v, env)}`;
}
