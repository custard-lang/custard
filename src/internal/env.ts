import * as path from "node:path";

import {
  isRecursiveConst,
  TranspileError,
  Writer,
  FilePath,
  Id,
  isNamespace,
  PropertyAccess,
  CuSymbol,
  isCuSymbol,
  isPropertyAccess,
  JsModule,
  Scope,
  ProvidedSymbolsConfig,
  canBePseudoTopLevelReferenced,
} from "./types.js";
import type { Env, TranspileState } from "./types.js";
import * as References from "./references.js";
import * as ScopeF from "./scope.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";
import { assertNonNull, expectNever } from "../util/error.js";
import { escapeRegExp } from "../util/regexp.js";

// To distinguish jsTopLevels and the top level scope of the code,
// assign the second scope as the top level.
const TOP_LEVEL_OFFSET = 1;

export function init<State extends TranspileState>(
  state: State,
  { modulePaths, jsTopLevels }: ProvidedSymbolsConfig,
): Env<State> {
  const topLevelScope = ScopeF.initAsync();
  ScopeF.addPrimitives(topLevelScope);
  ScopeF.addProvidedConsts(topLevelScope, jsTopLevels);
  return {
    scopes: [topLevelScope],
    references: References.init(),
    modules: modulePaths,
    transpileState: state,
  };
}

export function find(env: Env, id: Id): Writer | undefined {
  const r = findWithIsAtTopLevel(env, id);
  if (r === undefined) {
    return r;
  }
  return r.writer;
}

export type WriterWithIsAtTopLevel = {
  readonly writer: Writer;
  readonly mayBeAtPseudoTopLevel: boolean;
};

export function findWithIsAtTopLevel(
  { scopes }: Env,
  id: Id,
): WriterWithIsAtTopLevel | undefined {
  const topLevelI = scopes.length - TOP_LEVEL_OFFSET;
  for (const [i, frame] of scopes.entries()) {
    const writer = ScopeF.get(frame, id);
    if (writer !== undefined) {
      return {
        writer,
        mayBeAtPseudoTopLevel:
          i === topLevelI && canBePseudoTopLevelReferenced(writer),
      };
    }
  }
  return undefined;
}

export function referTo(
  { scopes, references }: Env,
  symLike: CuSymbol | PropertyAccess,
): WriterWithIsAtTopLevel | TranspileError {
  const topLevelI = scopes.length - TOP_LEVEL_OFFSET;
  function byId(id: Id): WriterWithIsAtTopLevel | TranspileError {
    for (const [i, frame] of scopes.entries()) {
      const writer = ScopeF.get(frame, id);
      if (writer !== undefined) {
        const scopePath = references.currentScope.slice(i);
        References.add(references, { id, scopePath });
        return {
          writer,
          mayBeAtPseudoTopLevel:
            i === topLevelI && canBePseudoTopLevelReferenced(writer),
        };
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

    const r = byId(
      assertNonNull(id, "Assertion failed: empty PropertyAccess!"),
    );
    if (TranspileError.is(r) || !isNamespace(r.writer)) {
      return r;
    }

    let { definitions: scope } = r.writer;
    let lastW: Writer = r.writer;
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
      return { writer: subW, mayBeAtPseudoTopLevel: r.mayBeAtPseudoTopLevel };
    }
    return { writer: lastW, mayBeAtPseudoTopLevel: r.mayBeAtPseudoTopLevel };
  }
  return expectNever(symLike) as WriterWithIsAtTopLevel;
}

export function isDefinedInThisScope({ scopes }: Env, id: Id): boolean {
  const w = ScopeF.get(scopes[0], id);
  return w !== undefined && !isRecursiveConst(w);
}

export function isInAsyncContext(env: Env): boolean {
  return env.scopes[0].isAsync || isAtTopLevel(env);
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

export function push({ scopes, references }: Env, isAsync = false): void {
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

export function findModule(env: Env, id: Id): FindModuleResult | undefined {
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

export function getCurrentScope({ scopes }: Env): Scope {
  return assertNonNull(scopes[0], "Empty scopes in an env!");
}

export function isAtTopLevel({ scopes }: Env): boolean {
  return scopes.length <= TOP_LEVEL_OFFSET;
}

export function isAtReplTopLevel(env: Env): boolean {
  return isAtTopLevel(env) && env.transpileState.mode === "repl";
}

export function writerIsAtReplTopLevel(
  env: Env,
  r: WriterWithIsAtTopLevel,
): boolean {
  return r.mayBeAtPseudoTopLevel && env.transpileState.mode === "repl";
}

export function tmpVarOf(
  { scopes }: Env<TranspileState>,
  exp: JsModule,
): { statement: JsModule; id: Id } {
  return ScopeF.tmpVarOf(scopes[0], exp);
}
