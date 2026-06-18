import * as path from "node:path";

import {
  type Writer,
  isRecursiveConst,
  type ScopeOptions,
  defaultScopeOptions,
  defaultAsyncScopeOptions,
  type HowToRefer,
  type TranspileState,
  ktvalOther,
  readerInput,
  ProvidedSymbolsConfig,
  FilePathAndStat,
} from "./types.js";
import {
  TranspileError,
  type FilePath,
  type Id,
  type JsSrc,
  type Ktvals,
  type Namespace,
  ktvalRefer,
  type Context,
  type ReaderInput,
} from "../types.js";
import * as References from "./references.js";
import * as ScopeF from "./scope.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";
import { escapeRegExp } from "../util/regexp.js";
import { resolveModulePaths } from "../provided-symbols-config.js";
import { parseAbsoluteUrl } from "../util/path.js";
import { stat } from "node:fs/promises";
import { TOP_LEVEL_OFFSET } from "./context/core.js";

export * from "./context/resolve.js";

export function init<State extends TranspileState>(
  state: State,
  providedSymbolsConfig: ProvidedSymbolsConfig,
  providedSymbolsConfigPath: FilePathAndStat,
): Context<State> | TranspileError {
  const topLevelScope = ScopeF.init(defaultAsyncScopeOptions);
  ScopeF.addPrimitives(topLevelScope);
  ScopeF.addProvidedConsts(topLevelScope, providedSymbolsConfig.jsTopLevels);
  const modules = resolveModulePaths(
    providedSymbolsConfig,
    providedSymbolsConfigPath,
  );
  return {
    scopes: [topLevelScope],
    references: References.init(),
    modules,
    transpileState: state,
    importedModuleJsIds: new Map(),
  };
}

export function isDefinedInThisScope({ scopes }: Context, id: Id): boolean {
  const w = ScopeF.get(scopes[0], id);
  return w !== undefined && !isRecursiveConst(w);
}

export function isInAsyncContext({ scopes: [current] }: Context): boolean {
  return current.isAsync;
}

export function isInGeneratorContext({ scopes: [current] }: Context): boolean {
  return current.isGenerator;
}

export function set(
  { scopes, references: { referenceById, currentScope } }: Context,
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
  { scopes, references }: Context,
  scopeOptions: ScopeOptions = defaultScopeOptions,
): void {
  References.appendNewScope(references);
  scopes.unshift(ScopeF.init(scopeOptions));
}

export function pushInherited(context: Context): void {
  const { isAsync, isGenerator } = context.scopes[0];
  push(context, { isAsync, isGenerator });
}

export function pop({ scopes, references }: Context): void {
  References.returnToPreviousScope(references);
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  scopes.shift();
}

export interface ModulePathAndUrl {
  u: string; // Absolute URL
  r: FilePath; // Relative path
  k: string; // Used for key in Context.importedModuleJsIds
}

export async function findModule(
  context: Context,
  id: Id,
): Promise<ModulePathAndUrl | undefined> {
  const { modules } = context;
  const modFullPath = modules.get(id);
  if (modFullPath === undefined) {
    return;
  }

  return await modulePathAndUrl(context, modFullPath);
}

export function specifierOfFoundModule(
  context: Context,
  foundModule: ModulePathAndUrl,
): string {
  switch (context.transpileState.mode) {
    case "repl": {
      return foundModule.u;
    }
    case "module": {
      return foundModule.r;
    }
  }
}

export function mergeNamespaceIntoCurrentScope(
  { scopes: [current] }: Context,
  ns: Namespace,
): void {
  for (const [id, v] of Object.entries(ns)) {
    ScopeF.setAny(current, id, v);
  }
}

export function isAtTopLevel({ scopes }: Context): boolean {
  return scopes.length <= TOP_LEVEL_OFFSET;
}

export function tmpVarOf(
  { scopes }: Context,
  exp: Ktvals<JsSrc>,
): { statement: Ktvals<JsSrc>; id: Id } {
  return ScopeF.tmpVarOf(scopes[0], exp);
}

export function srcPathForErrorMessage({
  transpileState,
}: Context): FilePathAndStat {
  const { src, mode } = transpileState;
  const normalizedPath = path.normalize(src.path);
  if (mode === "repl") {
    return {
      ...src,
      path: replPromptPrefixOfNormalizedPath({ ...src, path: normalizedPath }),
    };
  }
  return { ...src, path: normalizedPath };
}

// TODO: Put this in a better directory.
export function replPromptPrefixOfNormalizedPath(
  pathAndStat: FilePathAndStat,
): string {
  return pathAndStat.isDirectory
    ? `${pathAndStat.path}//<NO FILE>`
    : pathAndStat.path;
}

export function readerInputOf(
  context: Context,
  contents: string,
  initialLineNumber = 1,
): ReaderInput {
  const srcPath = srcPathForErrorMessage(context);
  return readerInput(srcPath, contents, initialLineNumber);
}

export function setImportedModulesJsId(
  context: Context,
  { k }: ModulePathAndUrl,
  howToRefer: HowToRefer,
): void {
  context.importedModuleJsIds.set(k, howToRefer);
}

export function setImportedModulesJsIds(
  context: Context,
  { k }: ModulePathAndUrl,
  howToReferById: Map<Id, HowToRefer>,
): void {
  context.importedModuleJsIds.set(k, howToReferById);
}

export async function findIdAsJsSrc(
  context: Context,
  moduleName: string,
  id: Id,
): Promise<Ktvals<JsSrc> | undefined> {
  const { k } = await modulePathAndUrl(context, moduleName);

  const howToReferOrMap = context.importedModuleJsIds.get(k);
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
  context: Context,
  moduleName: string,
): Promise<ModulePathAndUrl> {
  const {
    transpileState: {
      src: { path: srcPath, isDirectory },
    },
  } = context;
  const schemeAndPath = parseAbsoluteUrl(moduleName);
  if (schemeAndPath !== null) {
    if (schemeAndPath[0] === "npm") {
      const packageName = schemeAndPath[1];
      const srcFullPath = isDirectory
        ? `${path.resolve(srcPath)}/`
        : path.resolve(srcPath);
      return {
        // TODO: The second argument for `import.meta.resolve` is supported
        //       only in Node.js with the `--experimental-import-meta-resolve`
        //       flag. We should implement a better way to resolve the package
        //       path that works in all environments.
        u: import.meta.resolve(
          packageName,
          new URL(`file:///${srcFullPath}`).href,
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
