import { ExpectNever, expectNever } from "../util/error.js";
import { type Awaitable, type Empty } from "../util/types.js";

import * as s from "../lib/spec.js";

export type Block<X extends Empty = Empty> = Array<Form<X>>;

export type Form<X extends Empty = Empty> =
  | LiteralList<X>
  | LiteralArray<X>
  | LiteralObject<X>
  | Atom<X>
  | LiteralUnquote<X>
  | LiteralSplice<X>;

// The ***Base interfaces are necessary to avoid circular references. But I'm not sure why this works!
interface ListBase<X extends Empty = Empty> {
  t: "List";
  v: Array<Form<X>>;
}

export type LiteralList<X extends Empty = Empty> = ListBase<X> & X;

export function emptyList(l: Location): LiteralList<Location> {
  return { ...l, t: "List", v: [] };
}

export function isList<X extends Empty>(v: Form<X>): v is LiteralList<X> {
  return v.t === "List";
}

export function list(...v: Form[]): LiteralList {
  return { t: "List", v };
}

interface CallBase<X extends Empty = Empty> {
  t: "List";
  v: [LiteralCuSymbol<X> | LiteralPropertyAccess<X>, ...Array<Form<X>>];
}

export type Call<X extends Empty = Empty> = CallBase<X> & X;

export interface LiteralArrayBase<X extends Empty = Empty> {
  t: "Array";
  v: Array<Form<X>>;
}

export type LiteralArray<X extends Empty = Empty> = LiteralArrayBase<X> & X;

export function isLiteralArray<X extends Empty = Empty>(
  v: Form<X>,
): v is LiteralArray<X> {
  return v.t === "Array";
}

export interface LiteralObjectBase<X extends Empty = Empty> {
  t: "Object";
  v: Array<KeyValue<X> | LiteralCuSymbol<X> | LiteralUnquote<X>>;
}

export type LiteralObject<X extends Empty = Empty> = LiteralObjectBase<X> & X;

export function isLiteralObject<X extends Empty = Empty>(
  v: Form<X>,
): v is LiteralObject<X> {
  return v.t === "Object";
}

// TODO: Perhaps key should be either an Atom or LiteralArray;
export type KeyValue<X extends Empty = Empty> = [Form<X>, Form<X>];

// This is used to see the element of the LiteralObject, that's why its
// argument is `Form | KeyValue`, unlike the other is* functions.
export function isKeyValue<X extends Empty = Empty>(
  v: Form<X> | KeyValue<X>,
): v is KeyValue<X> {
  return Array.isArray(v);
}

// The `Cu` prefix is only to avoid conflicts with TypeScript's builtin types.
export type Atom<X extends Empty = Empty> =
  | LiteralInteger32<X>
  | LiteralFloat64<X>
  | LiteralString<X>
  | ReservedSymbol<X>
  | LiteralCuSymbol<X>
  | LiteralPropertyAccess<X>;

export type LiteralInteger32<X extends Empty = Empty> = {
  t: "Integer32";
  v: number;
} & X;

export type LiteralFloat64<X extends Empty = Empty> = {
  t: "Float64";
  v: number;
} & X;

export type LiteralString<X extends Empty = Empty> = {
  t: "String";
  v: string;
} & X;

export type ReservedSymbol<X extends Empty = Empty> = {
  t: "ReservedSymbol";
  v: boolean | null;
} & X;

export type LiteralCuSymbol<X extends Empty = Empty> = {
  t: "Symbol";
  v: string;
} & X;

export function locatedCuSymbol(
  v: string,
  l: Location,
): LiteralCuSymbol<Location> {
  return { ...l, t: "Symbol", v };
}

export function cuSymbol(v: string): LiteralCuSymbol {
  return { t: "Symbol", v };
}

export function isCuSymbol<X extends Empty = Empty>(
  v: Form<X>,
): v is LiteralCuSymbol<X> {
  return v.t === "Symbol";
}

export type LiteralPropertyAccess<X extends Empty = Empty> = X & {
  t: "PropertyAccess";
  v: string[];
};

export function isPropertyAccess<X extends Empty = Empty>(
  v: Form<X>,
): v is LiteralPropertyAccess<X> {
  return v.t === "PropertyAccess";
}

export function showSymbolAccess(
  sym: LiteralCuSymbol | LiteralPropertyAccess,
): string {
  switch (sym.t) {
    case "Symbol":
      return sym.v;
    case "PropertyAccess":
      return sym.v.join(".");
    default:
      return expectNever(sym) as string;
  }
}

export type LiteralUnquote<X extends Empty = Empty> = X & {
  t: "Unquote";
  v: Form<X>;
};

export function isUnquote<X extends Empty = Empty>(
  v: Form<X>,
): v is LiteralUnquote<X> {
  return v.t === "Unquote";
}

export type LiteralSplice<X extends Empty = Empty> = X & {
  t: "Splice";
  v: Form<X>;
};

export function isSplice<X extends Empty = Empty>(
  v: Form<X>,
): v is LiteralSplice<X> {
  return v.t === "Splice";
}

export interface ReaderInput {
  readonly path: FilePath;
  readonly contents: string;
}

export interface Location {
  l: number;
  c: number;
  f: FilePath;
  // Add lexical binding information like Racket's syntax object?
}

export const unknownLocation: Location = Object.freeze({
  l: -1,
  c: -1,
  f: "THIS_SHOULD_NOT_BE_SHOWN",
});

export function formatForError(f: Form): string {
  return `\`${formatForErrorUnticked(f)}\``;
}

export function formatForErrorUnticked(f: Form): string {
  switch (f.t) {
    case "List":
      return `(List${formatForErrorElement(f.v, formatForErrorShallow)})`;
    case "Array":
      return `(Array${formatForErrorElement(f.v, formatForErrorShallow)})`;
    case "Object":
      return `(Object${formatForErrorElement(f.v, formatForErrorKV)})`;
    default:
      return formatForErrorEtc(f);
  }
}

function formatForErrorElement<T>(forms: T[], fx: (f: T) => string): string {
  const [first, ...rest] = forms;
  if (first === undefined) {
    return "";
  }
  if (rest.length === 0) {
    return ` ${fx(first)}`;
  }
  return ` ${fx(first)} ...`;
}

function formatForErrorKV(
  kv: KeyValue | LiteralCuSymbol | LiteralUnquote,
): string {
  if (isKeyValue(kv)) {
    return `${formatForErrorShallow(kv[0])}: ${formatForErrorShallow(kv[1])}`;
  }
  return formatForErrorShallow(kv);
}

function formatForErrorShallow(f: Form): string {
  switch (f.t) {
    case "List":
      return `(List ..)`;
    case "Array":
      return `(Array ..)`;
    case "Object":
      return `(Object ..)`;
    default:
      return formatForErrorEtc(f);
  }
}

function formatForErrorEtc(f: Atom | LiteralUnquote | LiteralSplice): string {
  switch (f.t) {
    case "Integer32":
    case "Float64":
      return `(${f.t} ${f.v})`;
    case "String":
      return `(String ${JSON.stringify(f.v)})`;
    case "ReservedSymbol":
      return `(ReservedSymbol ${f.v ?? "none"})`;
    case "Symbol":
      return `(Symbol ${f.v})`;
    case "PropertyAccess":
      return `(PropertyAccess ${f.v.join(".")})`;
    case "Unquote":
      return `$${formatForErrorUnticked(f.v)}`;
    case "Splice":
      return `..${formatForErrorUnticked(f.v)}`;
    default:
      throw ExpectNever(f);
  }
}

export interface ProvidedSymbolsConfig {
  // TODO: quoteされたFormにする。最終的にはProvidedSymbolsConfig全体を専用のマクロで設定する仕様に
  implicitStatements: string;
  modulePaths: ModulePaths;
  jsTopLevels: Id[];
}

export type CompleteProvidedSymbolsConfig = ProvidedSymbolsConfig & {
  from: FilePath;
};

// Intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
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
  srcPath: FilePath;
}

export function defaultTranspileOptions(): TranspileOptions {
  return { srcPath: process.cwd() };
}

export type Id = string;

export type FilePath = string;

export interface JsModule {
  readonly imports: JsSrc;
  readonly body: JsSrc;
}

export type JsModuleWithResult = JsModule & { lastExpression: JsSrc };

export type JsSrc = string;

export class TranspileError extends Error {
  override name = "TranspileError";

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isTranspileError = true;
  static is(e: unknown): e is TranspileError {
    return !!((e as { [key: string]: unknown })
      ?._cu$isTranspileError as boolean);
  }
}

export interface Env<State extends TranspileState = TranspileState> {
  readonly scopes: [Scope, ...Scope[]];
  readonly references: References; // References in the Progaram
  readonly modules: ModulePaths; // Mapping from module name to its path.
  readonly transpileState: State;
  readonly importedModuleJsIds: Map<FilePath, HowToRefer | Map<Id, HowToRefer>>;
}

export interface HowToRefer {
  id: Id;
  isPseudoTopLevel: IsPseudoTopLevel;
}

export type IsPseudoTopLevel = boolean;

export interface Scope {
  isAsync: boolean;
  isGenerator: boolean;
  definitions: ModuleMap;
  temporaryVariablesCount: number;
}

export type ScopeOptions = Pick<Scope, "isAsync" | "isGenerator">;

export const defaultScopeOptions = { isAsync: false, isGenerator: false };

export const defaultAsyncScopeOptions = { isAsync: true, isGenerator: false };

const WriterKindKey = Symbol("WriterKind");
export interface AnyWriter<K extends number> {
  readonly [WriterKindKey]: K;
}

export function isWriter(x: unknown): x is Writer {
  return (
    x != null &&
    typeof x === "object" &&
    WriterKindKey in (x as { [key: string]: unknown })
  );
}

export interface ContextualKeyword extends AnyWriter<0> {
  readonly companion: Id;
}
export function aContextualKeyword(companion: Id): ContextualKeyword {
  return { [WriterKindKey]: 0, companion };
}
export function isContextualKeyword(x: Writer): x is ContextualKeyword {
  return x[WriterKindKey] === 0;
}

export type Var = AnyWriter<1>;
export function aVar(): Var {
  return { [WriterKindKey]: 1 };
}
export function isVar(x: Writer): x is Var {
  return x[WriterKindKey] === 1;
}

export type Const = AnyWriter<2>;
export function aConst(): Const {
  return { [WriterKindKey]: 2 };
}
export function isConst(x: Writer): x is Const {
  return x[WriterKindKey] === 2;
}

export type RecursiveConst = AnyWriter<3>;
export function aRecursiveConst(): RecursiveConst {
  return { [WriterKindKey]: 3 };
}
export function isRecursiveConst(x: Writer): x is RecursiveConst {
  return x[WriterKindKey] === 3;
}

export interface Module {
  [id: Id]: Writer | unknown;
}

export type ModuleMap = Map<Id, Writer>;

export type Namespace = AnyWriter<4> & Module;
export function aNamespace(): Namespace {
  return Object.create(null, {
    [WriterKindKey]: {
      value: 4,
      enumerable: false,
      writable: false,
    },
  }) as Namespace;
}
export function isNamespace(x: Writer): x is Namespace {
  return x[WriterKindKey] === 4;
}

export type DirectWriter = (
  env: Env,
  ...forms: Form[]
) => Awaitable<JsSrc | TranspileError>;
export interface MarkedDirectWriter extends AnyWriter<5> {
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

// `FunctionWithEnv` must receive literally any values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionWithEnv = (env: Env, ...rest: any[]) => any | Error;
export interface MarkedFunctionWithEnv extends AnyWriter<6> {
  readonly call: FunctionWithEnv;
}
export function markAsFunctionWithEnv(
  call: FunctionWithEnv,
): MarkedFunctionWithEnv {
  return { [WriterKindKey]: 6, call };
}
export function isMarkedFunctionWithEnv(x: Writer): x is MarkedFunctionWithEnv {
  return x[WriterKindKey] === 6;
}

export type ProvidedConst = AnyWriter<7>;
export function aProvidedConst(): ProvidedConst {
  return { [WriterKindKey]: 7 };
}
export function isProvidedConst(x: Writer): x is ProvidedConst {
  return x[WriterKindKey] === 7;
}

export type DynamicVarFunction = (
  env: Env,
) => Awaitable<JsSrc | TranspileError>;

export interface DynamicVar extends AnyWriter<8> {
  call: DynamicVarFunction;
}
export function isDynamicVar(x: Writer): x is DynamicVar {
  return x[WriterKindKey] === 8;
}
export function markAsDynamicVar(call: DynamicVarFunction): DynamicVar {
  return { [WriterKindKey]: 8, call };
}

export type MacroBody = (
  env: Env,
  ...forms: Form[]
) => Awaitable<Form | TranspileError>;

export interface Macro extends AnyWriter<9> {
  readonly expand: MacroBody;
}
export function markAsMacro(expand: MacroBody): Macro {
  return { [WriterKindKey]: 9, expand };
}
export function isMacro(x: Writer): x is Macro {
  return x[WriterKindKey] === 9;
}

export type Writer =
  | ContextualKeyword
  | Var
  | Const
  | RecursiveConst
  | Namespace
  | MarkedDirectWriter
  | MarkedFunctionWithEnv
  | ProvidedConst
  | DynamicVar
  | Macro;

export type CanBePseudoTopLevelReferenced =
  | Var
  | Const
  | RecursiveConst
  | Namespace;

export function canBePseudoTopLevelReferenced(
  x: Writer,
): x is CanBePseudoTopLevelReferenced {
  return isVar(x) || isConst(x) || isRecursiveConst(x) || isNamespace(x);
}

export interface References {
  readonly referenceById: Map<Id, Ref[]>;
  readonly currentScope: ScopePath;
  nextScope: ScopeIndex;
}

export type TranspileState = TranspileRepl | TranspileModule;

export type TranspileRepl = TranspileOptions & {
  mode: "repl";
  // `topLevelValues` must contain literally any values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topLevelValues: Map<Id, any>;
};

export type TranspileModule = TranspileOptions & {
  mode: "module";
  importsSrc: JsSrc;
};

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
