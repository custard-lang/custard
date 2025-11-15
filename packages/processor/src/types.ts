import type { FilePath } from "./internal/types.js";

// TODO: Reconsider what to export or not.
export {
  type Context,
  type Environment,
  type Form,
  type Block,
  type Call,
  type Atom,
  type Location,
  type ReaderInput,
  readerInput,
  functionIdOfCall,
  formatForError,
  aConst,
  aContextualKeyword,
  aVar,
  isConst,
  showSymbolAccess,
  markAsDirectWriter,
  markAsDynamicVar,
  markAsFunctionWithContext,
  type Macro,
  markAsMacro,
  isMacro,
  ProvidedSymbolsConfig,
  type Namespace,
  type ModulePaths,
  type TranspileOptions,
  type TranspileModule,
  type TranspileRepl,
  type TranspileState,
  defaultTranspileOptions,
  fromDefaultTranspileOptions,
  type RuntimeModuleEmission,
  RuntimeModuleEmissionValues,
  type Id,
  type FilePath,
  type FilePathAndStat,
  assumeIsFile,
  normalizeFilePathAndStat,
  type Ktval,
  type Ktvals,
  type KtvalRefer,
  type KtvalAssign,
  type KtvalFunctionPostlude,
  type KtvalImport,
  type KtvalImportStarAs as KtvalImportStartAs,
  type KtvalExport,
  type KtvalOther,
  KtvalReferT,
  KtvalAssignT,
  KtvalFunctionPostludeT,
  KtvalImportT,
  KtvalImportStarAsT as KtvalImportStartAsT,
  KtvalExportT,
  KtvalOtherT,
  ktvalRefer,
  ktvalAssignSimple,
  ktvalAssignDestructuringObject,
  ktvalAssignDestructuringArray,
  ktvalFunctionPostlude,
  ktvalImport,
  ktvalImportStarAs as ktvalImportStartAs,
  ktvalExport,
  ktvalOther,
  type JsSrc,
  type JsModule,
  TranspileError,
} from "./internal/types.js";
export { isList, list, type List } from "./internal/types/list.js";
export {
  isInteger32,
  integer32,
  Integer32,
} from "./internal/types/integer32.js";
export { isFloat64, float64, Float64 } from "./internal/types/float64.js";
export {
  isReservedSymbol,
  reservedSymbol,
  ReservedSymbol,
} from "./internal/types/reserved-symbol.js";
export { isCuSymbol, cuSymbol, CuSymbol } from "./internal/types/cu-symbol.js";
export { isCuString, cuString, CuString } from "./internal/types/cu-string.js";
export { isCuObject, cuObject, CuObject } from "./internal/types/cu-object.js";
export { isCuArray, cuArray, type CuArray } from "./internal/types/cu-array.js";
export {
  isKeyValue,
  keyValue,
  KeyValue,
  isComputedKey,
  type ComputedKey,
  computedKey,
  type KeyValueKey,
} from "./internal/types/key-value.js";
export {
  isPropertyAccess,
  propertyAccess,
  PropertyAccess,
} from "./internal/types/property-access.js";
export { isUnquote, unquote, type Unquote } from "./internal/types/unquote.js";
export { isSplice, splice, type Splice } from "./internal/types/splice.js";

export interface ReadStringOptions {
  readonly path?: FilePath;
  readonly isDirectory?: boolean;
  readonly line?: number;
}
