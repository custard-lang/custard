import * as path from "node:path";

import {
  type Writer,
  isRecursiveConst,
  isNamespace,
  type Scope,
  canBePseudoTopLevelReferenced,
  isWriter,
  type ScopeOptions,
  defaultScopeOptions,
  defaultAsyncScopeOptions,
  type HowToRefer,
  type TranspileState,
  ktvalOther,
} from "./types.js";
import {
  TranspileError,
  type FilePath,
  type Id,
  type PropertyAccess,
  type CuSymbol,
  isCuSymbol,
  isPropertyAccess,
  type JsSrc,
  type Ktvals,
  type CompleteProvidedSymbolsConfig,
  type Namespace,
  ktvalRefer,
  aConst,
  type Env,
  type ReaderInput,
} from "../types.js";
import * as References from "./references.js";
import * as ScopeF from "./scope.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";
import { assertNonNull, ExpectNever } from "../util/error.js";
import { escapeRegExp } from "../util/regexp.js";
import { resolveModulePaths } from "../provided-symbols-config.js";
import { parseAbsoluteUrl } from "../util/path.js";
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
    importedModuleJsIds: new Map(),
  };
}

export function find(
  env: Env,
  symLike: CuSymbol | PropertyAccess,
): Writer | undefined {
  const r = findWithIsAtTopLevel(env, symLike);
  if (r === undefined) {
    return r;
  }
  return r.writer;
}

export interface WriterWithIsAtTopLevel {
  readonly writer: Writer;
  readonly canBeAtPseudoTopLevel: boolean;
}

export function findWithIsAtTopLevel(
  env: Env,
  symLike: CuSymbol | PropertyAccess,
): WriterWithIsAtTopLevel | undefined {
  const r = findCore(env, symLike, false);
  if (TranspileError.is(r)) {
    return undefined;
  }
  return r;
}

export function referTo(
  env: Env,
  symLike: CuSymbol | PropertyAccess,
): WriterWithIsAtTopLevel | TranspileError {
  return findCore(env, symLike, true);
}

function findCore(
  { scopes, references }: Env,
  symLike: CuSymbol | PropertyAccess,
  doRefer: boolean,
): WriterWithIsAtTopLevel | TranspileError {
  const topLevelI = scopes.length - TOP_LEVEL_OFFSET;
  function byId(id: Id): WriterWithIsAtTopLevel | TranspileError {
    for (const [i, frame] of scopes.entries()) {
      const writer = ScopeF.get(frame, id);
      if (writer !== undefined) {
        if (doRefer) {
          const scopePath = references.currentScope.slice(i);
          References.add(references, { id, scopePath });
        }
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
    return byId(symLike.value);
  }
  if (isPropertyAccess(symLike)) {
    const [id, ...restIds] = symLike.value;

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
          `\`${part}\` is not defined in \`${symLike.value
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
  throw ExpectNever(symLike);
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
  const rs = referenceById.get(id) ?? [];
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
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  scopes.shift();
}

export interface ModulePathAndUrl {
  u: string; // Absolute URL
  r: FilePath; // Relative path
  k: string; // Used for key in Env.importedModuleJsIds
}

export async function findModule(
  env: Env,
  id: Id,
): Promise<ModulePathAndUrl | undefined> {
  const { modules } = env;
  const modFullPath = modules.get(id);
  if (modFullPath === undefined) {
    return;
  }

  return await modulePathAndUrl(env, modFullPath);
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

export function tmpVarOf(
  { scopes }: Env,
  exp: Ktvals<JsSrc>,
): { statement: Ktvals<JsSrc>; id: Id } {
  return ScopeF.tmpVarOf(scopes[0], exp);
}

export function srcPathForErrorMessage({ transpileState }: Env): FilePath {
  const normalizedPath = path.normalize(transpileState.srcPath);
  if (transpileState.mode === "repl") {
    return replPromptPrefixOfNormalizedPath(normalizedPath);
  }
  return normalizedPath;
}

// TODO: Put this in a better directory.
export function replPromptPrefixOfNormalizedPath(path: FilePath): string {
  return `${path}//(REPL)`;
}

export function readerInputOf(env: Env, contents: string): ReaderInput {
  return { path: srcPathForErrorMessage(env), contents };
}

export function setImportedModulesJsId(
  env: Env,
  { k }: ModulePathAndUrl,
  howToRefer: HowToRefer,
): void {
  env.importedModuleJsIds.set(k, howToRefer);
}

export async function findIdAsJsSrc(
  env: Env,
  moduleName: string,
  id: Id,
): Promise<Ktvals<JsSrc> | undefined> {
  const { k } = await modulePathAndUrl(env, moduleName);

  const howToReferOrMap = env.importedModuleJsIds.get(k);
  if (howToReferOrMap == null) {
    return;
  }

  if (howToReferOrMap instanceof Map) {
    const howToRefer = howToReferOrMap.get(id);
    if (howToRefer == null) {
      return;
    }
    return [ktvalRefer(howToRefer.id)];
  }
  return [ktvalRefer(howToReferOrMap.id), ktvalOther(`.${id}`)];
}

async function modulePathAndUrl(
  env: Env,
  moduleName: string,
): Promise<ModulePathAndUrl> {
  const {
    transpileState: { srcPath },
  } = env;
  const schemeAndPath = parseAbsoluteUrl(moduleName);
  if (schemeAndPath !== null) {
    if (schemeAndPath[0] === "npm") {
      const packageName = schemeAndPath[1];
      return {
        u: import.meta.resolve(
          packageName,
          new URL(`file:///${path.resolve(srcPath)}`).href,
        ),
        r: packageName,
        k: moduleName,
      };
    }
    return {
      u: moduleName,
      r: moduleName,
      k: moduleName,
    };
  }

  const src = await stat(srcPath);
  const currentFileDir = src.isDirectory() ? srcPath : path.dirname(srcPath);
  const uncanonicalPath = path.relative(
    path.resolve(currentFileDir),
    moduleName,
  );
  const relPath = /^\.\.?[/\\]/.test(uncanonicalPath)
    ? uncanonicalPath
    : `./${uncanonicalPath}`;

  const u = `file://${moduleName}`;
  return {
    u,
    r:
      path.sep === "/"
        ? relPath
        : relPath.replace(new RegExp(escapeRegExp(path.sep), "g"), "/"),
    k: u,
  };
}
