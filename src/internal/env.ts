import * as path from "node:path";

import {
  Scope,
  isRecursiveConst,
  TranspileError,
  Writer,
  ModulePaths,
  FilePath,
  aVar,
  Id,
} from "../types.js";
import type { Env, TranspileState } from "./types.js";
import * as References from "./references.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";
import { expectNever } from "../util/error.js";
import { escapeRegExp } from "../util/regexp.js";

export async function init<State extends TranspileState>(
  initial: Scope,
  state: State,
  modulePaths: ModulePaths = new Map(),
): Promise<Env<State>> {
  return {
    scopes: [initial],
    references: References.init(),
    modules: modulePaths,
    transpileState: state,
  };
}

export function find({ scopes }: Env, id: Id): Writer | undefined {
  for (const frame of scopes.values()) {
    const result = frame.get(id);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export function referTo(
  { scopes, references }: Env,
  id: Id,
): Writer | TranspileError {
  for (const [i, frame] of scopes.entries()) {
    const result = frame.get(id);
    if (result !== undefined) {
      const scopePath = references.currentScope.slice(i);
      References.add(references, { id, scopePath });
      return result;
    }
  }
  return new TranspileError(
    `No variable \`${id}\` is defined! NOTE: If you want to define \`${id}\` recursively, wrap the declaration(s) with \`recursive\`.`,
  );
}

export function isDefinedInThisScope({ scopes }: Env, id: Id): boolean {
  const w = scopes[0].get(id);
  return w !== undefined && !isRecursiveConst(w);
}

export function set(
  { scopes, references: { referenceById, currentScope } }: Env,
  id: Id,
  writer: Writer,
): undefined | TranspileError {
  const rs = referenceById.get(id) || [];
  if (
    rs.some(
      (references) =>
        isDeeperThanOrEqual(references.referer, currentScope) &&
        isShallowerThan(references.referee.scopePath, currentScope),
    )
  ) {
    return new TranspileError(
      `No variable \`${id}\` is defined! NOTE: If you want to define \`${id}\` recursively, wrap the declaration(s) with \`recursive\`.`,
    );
  }
  scopes[0].set(id, writer);
}

export function push({ scopes, references }: Env): void {
  References.appendNewScope(references);
  scopes.unshift(new Map());
}

export function pop({ scopes, references }: Env): void {
  References.returnToPreviousScope(references);
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  scopes.shift();
}

export function findModule(
  env: Env,
  id: Id,
): FilePath | undefined | TranspileError {
  const {
    modules,
    transpileState: { mode, src, srcPath },
  } = env;
  const modPath = modules.get(id);
  if (modPath === undefined) {
    return;
  }

  // If src is a directory, srcPath should be the absolute path to cwd.
  const currentFileDir = src.isDirectory() ? srcPath : path.dirname(srcPath);
  const modFullPath = path.resolve(currentFileDir, modPath);

  const references = set(env, id, aVar());
  if (references instanceof TranspileError) {
    return references;
  }

  switch (mode) {
    case "repl":
      return `file://${modFullPath}`;
    case "module":
      const relativeModPath = path.relative(
        path.resolve(currentFileDir),
        modFullPath,
      );
      return path.sep === "/"
        ? relativeModPath
        : relativeModPath.replace(new RegExp(escapeRegExp(path.sep), "g"), "/");
    default:
      expectNever(mode);
  }
}

export function isAtTopLevel({ scopes }: Env): boolean {
  return scopes.length <= 1;
}
