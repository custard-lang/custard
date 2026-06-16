import { type Awaitable, type Empty } from "../util/types.js";
import path from "node:path";

import * as s from "../lib/spec.js";
import { type List, isList, list } from "./types/list.js";
import { type CuArray, cuArray, isCuArray } from "./types/cu-array.js";
import { CuObject, isCuObject } from "./types/cu-object.js";
import { type Integer32, integer32, isInteger32 } from "./types/integer32.js";
import { type Float64, float64, isFloat64 } from "./types/float64.js";
import { type CuString, cuString, isCuString } from "./types/cu-string.js";
import {
  type ReservedSymbol,
  reservedSymbol,
  isReservedSymbol,
} from "./types/reserved-symbol.js";
import { type CuSymbol, cuSymbol, isCuSymbol } from "./types/cu-symbol.js";
import {
  type PropertyAccess,
  propertyAccess,
  isPropertyAccess,
} from "./types/property-access.js";
import { type Unquote, unquote, isUnquote } from "./types/unquote.js";
import { type Splice, splice, isSplice } from "./types/splice.js";
import { isComputedKey, isKeyValue, type KeyValue } from "./types/key-value.js";
import { type Id } from "./types/id.js";
import { type Ktvals } from "./types/ktval.js";
import { type TranspileError } from "./types/errors.js";

export * from "./types/ktval.js";
export * from "./types/id.js";
export * from "./types/errors.js";

export type Block<X extends Empty = Empty> = Array<Form<X>>;

export type Form<X extends Empty = Empty> =
  | List<Form<X>, X>
  | CuArray<Form<X>, X>
  | CuObject<Form<X>, Form<X>, Form<X>, Form<X>, Form<X>, X>
  | AtomLike<X>
  | PropertyAccess<Form<X>, X>
  | Unquote<Form<X>, X>
  | Splice<Form<X>, X>;

export function locatedList(
  v: Array<Form<Location>>,
  l: Location,
): List<Form<Location>, Location> {
  const a = list(...v);
  a.extension = l;
  return a as List<Form<Location>, Location>;
}

export function locatedCuArray(
  v: Array<Form<Location>>,
  l: Location,
): CuArray<Form<Location>, Location> {
  const a = cuArray(...v);
  a.extension = l;
  return a as CuArray<Form<Location>, Location>;
}

export function locatedCuObject(
  v: Array<
    | KeyValue<Form<Location>, Form<Location>, Form<Location>, Location>
    | CuSymbol<Location>
    | Unquote<Form<Location>, Location>
    | Splice<Form<Location>, Location>
  >,
  l: Location,
): CuObject<
  Form<Location>,
  Form<Location>,
  Form<Location>,
  Form<Location>,
  Form<Location>,
  Location
> {
  const o = new CuObject(v);
  o.extension = l;
  return o;
}

interface ValidCallBrand {
  readonly _ValidCallBrand: unique symbol;
}

export interface Call<X extends Empty = Empty>
  extends List<Form<X>, X>, ValidCallBrand {}

export function functionIdOfCall<X extends Empty = Empty>(
  v: Call<X>,
): CuSymbol<X> | PropertyAccess<Form<X>, X> {
  return v.values[0] as CuSymbol<X> | PropertyAccess<Form<X>, X>;
}

// The `Cu` prefix is only to avoid conflicts with TypeScript's builtin types.
export type AtomLike<X extends Empty = Empty> =
  | Integer32<X>
  | Float64<X>
  | CuString<X>
  | ReservedSymbol<X>
  | CuSymbol<X>;

export function locatedInteger32(v: number, l: Location): Integer32<Location> {
  const i = integer32(v);
  i.extension = l;
  return i as Integer32<Location>;
}

export function locatedFloat64(v: number, l: Location): Float64<Location> {
  const f = float64(v);
  f.extension = l;
  return f as Float64<Location>;
}

export function locatedCuString(v: string, l: Location): CuString<Location> {
  const s = cuString(v);
  s.extension = l;
  return s as CuString<Location>;
}

export function locatedReservedSymbol(
  v: boolean | null,
  l: Location,
): ReservedSymbol<Location> {
  const s = reservedSymbol(v);
  s.extension = l;
  return s as ReservedSymbol<Location>;
}

export function locatedCuSymbol(v: string, l: Location): CuSymbol<Location> {
  const s = cuSymbol(v);
  s.extension = l;
  return s as CuSymbol<Location>;
}

export function locatedPropertyAccess(
  left: Form<Location>,
  right: Id,
  l: Location,
): PropertyAccess<Form<Location>, Location> {
  const p = propertyAccess(left, right);
  p.extension = l;
  return p as PropertyAccess<Form<Location>, Location>;
}

export function locatedUnquote(
  v: Form<Location>,
  l: Location,
): Unquote<Form<Location>, Location> {
  const u = unquote(v);
  u.extension = l;
  return u as Unquote<Form<Location>, Location>;
}

export function locatedSplice(
  v: Form<Location>,
  l: Location,
): Splice<Form<Location>, Location> {
  const s = splice(v);
  s.extension = l;
  return s as Splice<Form<Location>, Location>;
}

export interface ReaderInput extends FilePathAndStat {
  readonly contents: string;
  readonly initialLineNumber: number;
}

export function readerInput(
  path: FilePathAndStat,
  contents: string,
  initialLineNumber = 1,
): ReaderInput {
  return { ...path, contents, initialLineNumber };
}

export interface Location {
  l: number;
  c: number;
  f: FilePath;
  // Add lexical binding information like Racket's syntax object?
}

export function formatForError(f: unknown): string {
  return `\`${formatForErrorUnticked(f)}\``;
}

function formatForErrorUnticked(f: unknown): string {
  if (isList(f)) {
    return `( ${formatForErrorElement(f.values, formatForErrorShallow)} )`;
  }
  if (isCuArray(f)) {
    return `[ ${formatForErrorElement(f, formatForErrorShallow)} ]`;
  }
  if (isCuObject(f)) {
    return `{ ${formatForErrorElement(f.keyValues, formatForErrorKV)} }`;
  }
  if (isComputedKey(f)) {
    return `[${formatForErrorShallow(f.value)}]`;
  }
  return formatForErrorEtc(f);
}

function formatForErrorElement<T>(forms: T[], fx: (f: T) => string): string {
  const [first, ...rest] = forms;
  if (first === undefined) {
    return "";
  }
  if (rest.length === 0) {
    return fx(first);
  }
  return `${fx(first)} <...rest>`;
}

function formatForErrorKV(
  kv: KeyValue<unknown> | CuSymbol | Unquote<unknown> | Splice<unknown>,
): string {
  if (isKeyValue(kv)) {
    const value = kv.value;
    if (isComputedKey(kv.key)) {
      return `[${formatForErrorShallow(kv.key.value)}]: ${formatForErrorShallow(value)}`;
    }
    return `${formatForErrorShallow(kv.key)}: ${formatForErrorShallow(value)}`;
  }
  return formatForErrorShallow(kv);
}

function formatForErrorShallow(f: unknown): string {
  if (isList(f)) {
    return `( <...list> )`;
  }
  if (isCuArray(f)) {
    return `[ <...array> ]`;
  }
  if (isCuObject(f)) {
    return `{ <...object> }`;
  }
  return formatForErrorEtc(f);
}

function formatForErrorEtc(f: unknown): string {
  if (isInteger32(f)) {
    return `<i32 ${String(f)}>`;
  }
  if (isFloat64(f)) {
    return `<f64 ${String(f)}>`;
  }
  if (isCuString(f)) {
    return JSON.stringify(f);
  }
  if (isReservedSymbol(f)) {
    return `${f.valueOf() ?? "none"}`;
  }
  if (isCuSymbol(f)) {
    return f.value;
  }
  if (isPropertyAccess(f)) {
    return `${formatForErrorUnticked(f.left)}.${f.right}`;
  }
  if (isUnquote(f)) {
    return `$${formatForErrorUnticked(f.value)}`;
  }
  if (isSplice(f)) {
    return `...${formatForErrorUnticked(f.value)}`;
  }
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return `(Other ${f})`;
}

export interface ProvidedSymbolsConfig {
  // TODO: quoteされたFormにする。最終的にはProvidedSymbolsConfig全体を専用のマクロで設定する仕様に
  implicitStatements: string;
  modulePaths: ModulePaths;
  jsTopLevels: Id[];
}

export const ProvidedSymbolsConfig: s.Spec<ProvidedSymbolsConfig> = s.withId(
  "ProvidedSymbolsConfig",
  s.record({
    implicitStatements: s.string,
    modulePaths: s.map(s.string, s.string),
    jsTopLevels: s.array(s.string),
  }),
);

export type ModulePaths = Map<Id, FilePath>;

export interface TranspileOptions {
  src: FilePathAndStat;
  runtimeModuleEmission: RuntimeModuleEmission;
  // ^ How to emit the runtime module import.
  //   TODO: Not availeble in REPL, but the current type structure doesn't express it.
}

export function defaultTranspileOptions(): TranspileOptions {
  return {
    src: { path: `${process.cwd()}/`, isDirectory: true },
    runtimeModuleEmission: "import",
  };
}

export function fromDefaultTranspileOptions(
  opts: Partial<TranspileOptions>,
): TranspileOptions {
  return {
    ...defaultTranspileOptions(),
    ...opts,
  };
}

export function normalizeSrcPath(opts: TranspileOptions): TranspileOptions {
  return {
    ...opts,
    src: normalizeFilePathAndStat(opts.src),
  };
}

export const RuntimeModuleEmissionValues = ["none", "import"] as const;

export type RuntimeModuleEmission =
  (typeof RuntimeModuleEmissionValues)[number];

export type FilePath = string;

export interface FilePathAndStat {
  readonly path: FilePath;
  readonly isDirectory: boolean;
}

export function assumeIsFile(path: FilePath): FilePathAndStat {
  return { path, isDirectory: false };
}

export function normalizeFilePathAndStat(
  filePathAndStat: FilePathAndStat,
): FilePathAndStat {
  return {
    ...filePathAndStat,
    path: path.normalize(filePathAndStat.path),
  };
}

export interface JsModule {
  readonly imports: Ktvals<JsSrc>;
  readonly body: Ktvals<JsSrc>;
}

export type JsSrc = string;

export interface Environment<State extends TranspileState = TranspileState> {
  readonly f: FilePath;
  readonly c: Map<FilePath, Context<State>>;
}

export interface Context<State extends TranspileState = TranspileState> {
  readonly scopes: [Scope, ...Scope[]];
  readonly references: References; // References in the Program
  readonly modules: ModulePaths; // Mapping from module name to its path.
  readonly transpileState: State;
  readonly importedModuleJsIds: Map<FilePath, HowToRefer | Map<Id, HowToRefer>>;
}

export interface HowToRefer {
  id: Id;
  isTopLevel: boolean;
}

export interface ScopeOptions {
  isAsync: boolean;
  isGenerator: boolean;
}

export interface Scope extends ScopeOptions {
  definitions: ModuleMap;
  temporaryVariablesCount: number;
}

export const defaultScopeOptions = { isAsync: false, isGenerator: false };

export const defaultAsyncScopeOptions = { isAsync: true, isGenerator: false };

const WriterKindKey = Symbol("WriterKind");
export interface AnyWriter<K extends number> {
  readonly [WriterKindKey]: K;
}

export type Writer =
  | ContextualKeyword
  | Var
  | Const
  | RecursiveConst
  | Namespace
  | MarkedDirectWriter
  | MarkedFunctionWithContext
  | ProvidedConst
  | DynamicVar
  | Macro;

export type WriterKind = Writer[typeof WriterKindKey];

const writerKindHumanReadableName = new Map<WriterKind, string>();

export function isWriter(x: unknown): x is Writer {
  return (
    x != null &&
    typeof x === "object" &&
    WriterKindKey in (x as { [key: string]: unknown })
  );
}

export const WriterKindContextualKeyword = 0;
writerKindHumanReadableName.set(
  WriterKindContextualKeyword,
  "ContextualKeyword",
);
export type WriterKindContextualKeyword = typeof WriterKindContextualKeyword;
export interface ContextualKeyword extends AnyWriter<WriterKindContextualKeyword> {
  readonly companion: Id;
}
export function aContextualKeyword(companion: Id): ContextualKeyword {
  return { [WriterKindKey]: WriterKindContextualKeyword, companion };
}
export function isContextualKeyword(x: Writer): x is ContextualKeyword {
  return x[WriterKindKey] === WriterKindContextualKeyword;
}

export const WriterKindVar = 1;
writerKindHumanReadableName.set(WriterKindVar, "Var");
export type WriterKindVar = typeof WriterKindVar;
export type Var = AnyWriter<WriterKindVar>;
export function aVar(): Var {
  return { [WriterKindKey]: WriterKindVar };
}
export function isVar(x: Writer): x is Var {
  return x[WriterKindKey] === WriterKindVar;
}

export const WriterKindConst = 2;
writerKindHumanReadableName.set(WriterKindConst, "Const");
export type WriterKindConst = typeof WriterKindConst;
export type Const = AnyWriter<WriterKindConst>;
export function aConst(): Const {
  return { [WriterKindKey]: WriterKindConst };
}
export function isConst(x: Writer): x is Const {
  return x[WriterKindKey] === WriterKindConst;
}

export const WriterKindRecursiveConst = 3;
writerKindHumanReadableName.set(WriterKindRecursiveConst, "RecursiveConst");
export type WriterKindRecursiveConst = typeof WriterKindRecursiveConst;
export type RecursiveConst = AnyWriter<WriterKindRecursiveConst>;
export function aRecursiveConst(): RecursiveConst {
  return { [WriterKindKey]: WriterKindRecursiveConst };
}
export function isRecursiveConst(x: Writer): x is RecursiveConst {
  return x[WriterKindKey] === WriterKindRecursiveConst;
}

export interface Module {
  [id: Id]: Writer | unknown;
}

export type ModuleMap = Map<Id, Writer>;

export const WriterKindNamespace = 4;
writerKindHumanReadableName.set(WriterKindNamespace, "Namespace");
export type WriterKindNamespace = typeof WriterKindNamespace;
export type Namespace = AnyWriter<WriterKindNamespace> & Module;
export function aNamespace(): Namespace {
  return Object.create(null, {
    [WriterKindKey]: {
      value: WriterKindNamespace,
      enumerable: false,
      writable: false,
    },
  }) as Namespace;
}
export function isNamespace(x: Writer): x is Namespace {
  return x[WriterKindKey] === WriterKindNamespace;
}

export type DirectWriter = (
  context: Context,
  // To handle cases where it receives non-`Form` values returned by a `Macro`,
  // `DirectWriter` must also receive literally any values.
  ...forms: unknown[]
) => Awaitable<Ktvals<JsSrc> | TranspileError>;

export const WriterKindDirectWriter = 5;
writerKindHumanReadableName.set(WriterKindDirectWriter, "DirectWriter");
export type WriterKindDirectWriter = typeof WriterKindDirectWriter;
export interface MarkedDirectWriter extends AnyWriter<WriterKindDirectWriter> {
  readonly call: DirectWriter;
  readonly kind: DirectWriterKindFlags;
}

// I'm not really sure the best type to represent
// how DirectWriter's are classified.
// Another plan:
//   DirectWriterKind = EXPRESSION | STATEMENT | EXPORTABLE.
// where EXPRESSION < STATEMENT < EXPORTABLE.
export interface DirectWriterKindFlags {
  statement: boolean;
  exportable: boolean;
}

export const ordinaryExpression = {
  statement: false,
  exportable: false,
};

export const ordinaryStatement = {
  statement: true,
  exportable: false,
};

export const exportableStatement = {
  statement: true,
  exportable: true,
};

export function markAsDirectWriter(
  call: DirectWriter,
  kind: DirectWriterKindFlags = ordinaryExpression,
): MarkedDirectWriter {
  return { [WriterKindKey]: 5, call, kind };
}
export function isMarkedDirectWriter(x: Writer): x is MarkedDirectWriter {
  return x[WriterKindKey] === 5;
}
export function isMarkedDirectStatementWriter(
  x: Writer,
): x is MarkedDirectWriter {
  return isMarkedDirectWriter(x) && x.kind.statement;
}
export function isMarkedDirectExportableStatementWriter(
  x: Writer,
): x is MarkedDirectWriter {
  return isMarkedDirectWriter(x) && x.kind.exportable;
}

export const WriterKindMarkedFunctionWithContext = 6;
writerKindHumanReadableName.set(
  WriterKindMarkedFunctionWithContext,
  "MarkedFunctionWithContext",
);
export type WriterKindMarkedFunctionWithContext =
  typeof WriterKindMarkedFunctionWithContext;
// `FunctionWithContext` must receive literally any values.
export type FunctionWithContext = (
  context: Context,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...rest: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any | Error;
export interface MarkedFunctionWithContext extends AnyWriter<WriterKindMarkedFunctionWithContext> {
  readonly call: FunctionWithContext;
}
export function markAsFunctionWithContext(
  call: FunctionWithContext,
): MarkedFunctionWithContext {
  return { [WriterKindKey]: WriterKindMarkedFunctionWithContext, call };
}
export function isMarkedFunctionWithContext(
  x: Writer,
): x is MarkedFunctionWithContext {
  return x[WriterKindKey] === WriterKindMarkedFunctionWithContext;
}

export const WriterKindProvidedConst = 7;
writerKindHumanReadableName.set(WriterKindProvidedConst, "ProvidedConst");
export type WriterKindProvidedConst = typeof WriterKindProvidedConst;
export type ProvidedConst = AnyWriter<WriterKindProvidedConst>;
export function aProvidedConst(): ProvidedConst {
  return { [WriterKindKey]: WriterKindProvidedConst };
}
export function isProvidedConst(x: Writer): x is ProvidedConst {
  return x[WriterKindKey] === WriterKindProvidedConst;
}

export const WriterKindDynamicVar = 8;
writerKindHumanReadableName.set(WriterKindDynamicVar, "DynamicVar");
export type WriterKindDynamicVar = typeof WriterKindDynamicVar;
export type DynamicVarFunction = (
  context: Context,
) => Awaitable<Ktvals<JsSrc> | TranspileError>;

export interface DynamicVar extends AnyWriter<WriterKindDynamicVar> {
  call: DynamicVarFunction;
}
export function isDynamicVar(x: Writer): x is DynamicVar {
  return x[WriterKindKey] === WriterKindDynamicVar;
}
export function markAsDynamicVar(call: DynamicVarFunction): DynamicVar {
  return { [WriterKindKey]: WriterKindDynamicVar, call };
}

export const WriterKindMacro = 9;
writerKindHumanReadableName.set(WriterKindMacro, "Macro");
export type WriterKindMacro = typeof WriterKindMacro;
export type MacroBody = (
  ...xs: unknown[]
) => Awaitable<unknown | TranspileError>;

export interface Macro extends AnyWriter<WriterKindMacro> {
  readonly expand: MacroBody;
}
export function markAsMacro(expand: MacroBody): Macro {
  return { [WriterKindKey]: WriterKindMacro, expand };
}
export function isMacro(x: Writer): x is Macro {
  return x[WriterKindKey] === WriterKindMacro;
}

export function writerKindToHumanReadableName(k: WriterKind): string {
  const name = writerKindHumanReadableName.get(k);
  if (name === undefined) {
    throw new Error(`Assertion failure: Unknown WriterKind: ${k}`);
  }
  return name;
}

export function writerToHumanReadableName(writer: Writer): string {
  return writerKindToHumanReadableName(writer[WriterKindKey]);
}

export function writerIsOneOf(
  writer: Writer,
  expectedKinds: WriterKind[],
): boolean {
  return expectedKinds.includes(writer[WriterKindKey]);
}

export interface SymbolResolutionResult {
  readonly writer: Writer;
  readonly canBeAtPseudoTopLevel: boolean;
}

export interface PropertyAccessResolutionResultCommon {
  readonly ids: [Id, ...Id[]];
}

export interface PropertyAccessResolutionResultOnlyId extends PropertyAccessResolutionResultCommon {
  readonly hasNonId: false;
  readonly writer: Writer;
  readonly canBeAtPseudoTopLevel: boolean;
}

export interface PropertyAccessResolutionResultDynamic extends PropertyAccessResolutionResultCommon {
  readonly hasNonId: true;
  readonly writer?: undefined;
  readonly nonId: unknown;
}

export type PropertyAccessResolutionResult =
  | PropertyAccessResolutionResultOnlyId
  | PropertyAccessResolutionResultDynamic;

export interface References {
  readonly referenceById: Map<Id, Ref[]>;
  readonly currentScope: ScopePath;
  nextScope: ScopeIndex;
}

export type TranspileState = TranspileRepl | TranspileModule;

export interface TranspileStateCore extends TranspileOptions {
  transpiledSrc: Ktvals<JsSrc>;
  evaluatedUpTo: number;
  currentBlockIndex: number;
  topLevelValues: TopLevelValues;
  // ^ When transpiling into the module it's used for macro,
  //   while in the REPL, it is used for both macro and the REPL session.
}

export interface TranspileRepl extends TranspileStateCore {
  mode: "repl";
}

export interface TranspileModule extends TranspileStateCore {
  mode: "module";
  importsSrc: Ktvals<JsSrc>;
}

// `TopLevelValues` must contain literally any values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopLevelValues = Map<Id, any>;

export interface Ref {
  readonly referer: ScopePath;
  readonly referee: ReferencePath;
}

export interface ReferencePath {
  scopePath: ScopePath; // Index of the every scope
  id: Id; // The variable name
}

export type ScopeIndex = number;

export type ScopePath = ScopeIndex[];
