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
  JsSrc,
  Scope,
  canBePseudoTopLevelReferenced,
  CompleteProvidedSymbolsConfig,
  Namespace,
  aConst,
  isWriter,
  ScopeOptions,
  defaultScopeOptions,
  defaultAsyncScopeOptions,
} from "./types.js";
import type { Env, TranspileState } from "./types.js";
import * as References from "./references.js";
import * as ScopeF from "./scope.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";
import { assertNonNull, expectNever } from "../util/error.js";
import { escapeRegExp } from "../util/regexp.js";
import { resolveModulePaths } from "../provided-symbols-config.js";
import { isAbsoluteUrl } from "../util/path.js";
import { stat } from "node:fs/promises";

// To distinguish jsTopLevels and the top level scope of the code,
// assign the second scope as the top level.
const TOP_LEVEL_OFFSET = 1;

export function init<State extends TranspileState>(
  state: State,
  providedSymbolsConfig: CompleteProvidedSymbolsConfig,
): Env<State> {
  const topLevelScope = ScopeF.init(defaultAsyncScopeOptions);
  ScopeF.addPrimitives(topLevelScope);
  ScopeF.addProvidedConsts(topLevelScope, providedSymbolsConfig.jsTopLevels);
  return {
    scopes: [topLevelScope],
    references: References.init(),
    modules: resolveModulePaths(providedSymbolsConfig),
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
  readonly canBeAtPseudoTopLevel: boolean;
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
        canBeAtPseudoTopLevel:
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
          canBeAtPseudoTopLevel:
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

    let module = r.writer;
    let lastW: Writer = r.writer;
    const { canBeAtPseudoTopLevel } = r;
    for (const [i, part] of restIds.entries()) {
      const subW = module[part];
      if (subW == null) {
        return new TranspileError(
          `\`${part}\` is not defined in \`${symLike.v
            .slice(0, i - 1)
            .join(".")}\`!`,
        );
      }
      if (isWriter(subW)) {
        if (isNamespace(subW)) {
          module = subW;
          lastW = subW;
          continue;
        }
        return { writer: subW, canBeAtPseudoTopLevel };
      }
      return { writer: aConst(), canBeAtPseudoTopLevel };
    }
    return { writer: lastW, canBeAtPseudoTopLevel };
  }
  return expectNever(symLike) as WriterWithIsAtTopLevel;
}

export function isDefinedInThisScope({ scopes }: Env, id: Id): boolean {
  const w = ScopeF.get(scopes[0], id);
  return w !== undefined && !isRecursiveConst(w);
}

export function isInAsyncContext({ scopes: [current] }: Env): boolean {
  return current.isAsync;
}

export function isInGeneratorContext({ scopes: [current] }: Env): boolean {
  return current.isGenerator;
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

export function push(
  { scopes, references }: Env,
  scopeOptions: ScopeOptions = defaultScopeOptions,
): void {
  References.appendNewScope(references);
  scopes.unshift(ScopeF.init(scopeOptions));
}

export function pushInherited(env: Env): void {
  const { isAsync, isGenerator } = env.scopes[0];
  push(env, { isAsync, isGenerator });
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

export async function findModule(
  env: Env,
  id: Id,
): Promise<FindModuleResult | undefined> {
  const {
    modules,
    transpileState: { srcPath },
  } = env;
  const modFullPath = modules.get(id);
  if (modFullPath === undefined) {
    return;
  }

  if (isAbsoluteUrl(modFullPath)) {
    return {
      url: modFullPath,
      relativePath: modFullPath,
    };
  }

  const src = await stat(srcPath);
  const currentFileDir = src.isDirectory() ? srcPath : path.dirname(srcPath);
  const uncanonicalPath = path.relative(
    path.resolve(currentFileDir),
    modFullPath,
  );

  return {
    url: `file://${modFullPath}`,
    relativePath:
      path.sep === "/"
        ? uncanonicalPath
        : uncanonicalPath.replace(new RegExp(escapeRegExp(path.sep), "g"), "/"),
  };
}

export function getCurrentScope({ scopes: [current] }: Env): Scope {
  return current;
}

export function mergeNamespaceIntoCurrentScope(
  { scopes }: Env,
  ns: Namespace,
): void {
  const { definitions } = assertNonNull(scopes[0], "Empty scopes in an env!");
  for (const [id, v] of Object.entries(ns)) {
    definitions.set(id, isWriter(v) ? v : aConst());
  }
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
  return r.canBeAtPseudoTopLevel && env.transpileState.mode === "repl";
}

export function tmpVarOf(
  { scopes }: Env<TranspileState>,
  exp: JsSrc,
): { statement: JsSrc; id: Id } {
  return ScopeF.tmpVarOf(scopes[0], exp);
}
