import * as path from "node:path";

import {
  Scope,
  isRecursiveConst,
  TranspileError,
  Writer,
  ModulePaths,
  FilePath,
  Id,
  isNamespace,
  PropertyAccess,
  CuSymbol,
  isCuSymbol,
  isPropertyAccess,
  aConst,
  cuSymbol,
} from "./types.js";
import type { Env, TranspileState } from "./types.js";
import * as References from "./references.js";
import * as ScopeF from "./scope.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";
import { assertNonNull, expectNever } from "../util/error.js";
import { escapeRegExp } from "../util/regexp.js";

export function init<State extends TranspileState>(
  initial: Scope,
  state: State,
  modulePaths: ModulePaths = new Map(),
): Env<State> {
  return {
    scopes: [initial],
    references: References.init(),
    modules: modulePaths,
    transpileState: state,
  };
}

export function find({ scopes }: Env, id: Id): Writer | undefined {
  for (const frame of scopes.values()) {
    const result = ScopeF.get(frame, id);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export function referTo(
  { scopes, references }: Env,
  symLike: CuSymbol | PropertyAccess,
): Writer | TranspileError {
  function byId(id: Id): Writer | TranspileError {
    for (const [i, frame] of scopes.entries()) {
      const result = ScopeF.get(frame, id);
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

  if (isCuSymbol(symLike)) {
    return byId(symLike.v);
  }
  if (isPropertyAccess(symLike)) {
    const [id, ...restIds] = symLike.v;

    const w = byId(
      assertNonNull(id, "Assertion failed: empty PropertyAccess!"),
    );
    if (w instanceof TranspileError || !isNamespace(w)) {
      return w;
    }

    let { definitions: scope } = w;
    let lastW = w;
    for (const [i, part] of restIds.entries()) {
      const subW = scope.get(part);
      if (subW === undefined) {
        return new TranspileError(
          `\`${part}\` is not defined in \`${symLike.v
            .slice(0, i - 1)
            .join(".")}\`!`,
        );
      }
      if (isNamespace(subW)) {
        scope = subW.definitions;
        lastW = subW;
        continue;
      }
      return subW;
    }
    return lastW;
  }
  return expectNever(symLike) as Writer;
}

export function isDefinedInThisScope({ scopes }: Env, id: Id): boolean {
  const w = ScopeF.get(scopes[0], id);
  return w !== undefined && !isRecursiveConst(w);
}

export function isInAsyncContext({ scopes }: Env): boolean {
  return scopes[0].isAsync;
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
  ScopeF.set(scopes[0], id, writer);
}

export function push({ scopes, references }: Env, isAsync: boolean = false): void {
  References.appendNewScope(references);
  scopes.unshift(isAsync ? ScopeF.initAsync() : ScopeF.init());
}

export function pushInherited(env: Env): void {
  push(env, env.scopes[0].isAsync);
}

export function pop({ scopes, references }: Env): void {
  References.returnToPreviousScope(references);
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  scopes.shift();
}

export type FindModuleResult = {
  url: FilePath;
  relativePath: FilePath;
};

export function findModule(
  env: Env,
  id: Id,
): FindModuleResult | undefined | TranspileError {
  const {
    modules,
    transpileState: { src, srcPath },
  } = env;
  const modPath = modules.get(id);
  if (modPath === undefined) {
    return;
  }

  // If src is a directory, srcPath should be the absolute path to cwd.
  const currentFileDir = src.isDirectory() ? srcPath : path.dirname(srcPath);
  const fullPath = path.resolve(currentFileDir, modPath);
  const uncanonicalPath = path.relative(path.resolve(currentFileDir), fullPath);

  return {
    url: `file://${fullPath}`,
    relativePath:
      path.sep === "/"
        ? uncanonicalPath
        : uncanonicalPath.replace(new RegExp(escapeRegExp(path.sep), "g"), "/"),
  };
}

export function isAtTopLevel({ scopes }: Env): boolean {
  return scopes.length <= 1;
}

export async function enablingCuEnv<T>(
  env: Env,
  f: (cuEnv: CuSymbol) => Promise<T>,
): Promise<T> {
  const id = "_cu$env";
  // TODO: I'm currently not sure how to handle the _cu$env variable here.
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  set(env, id, aConst());
  try {
    return await f(cuSymbol(id));
  } finally {
    ScopeF.destroy(env.scopes[0], id);
  }
}
