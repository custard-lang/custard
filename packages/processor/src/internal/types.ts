import { ExpectNever, expectNever } from "../util/error.js";
import { Awaitable, Empty } from "../util/types.js";

import * as s from "../lib/spec.js";

export type Block<X extends Empty = Empty> = Form<X>[];

export type Form<X extends Empty = Empty> = List<X> | LiteralArray<X> | LiteralObject<X> | Atom<X>;

// The ***Base interfaces are necessary to avoid circular references. But I'm not sure why this works!
interface ListBase<X extends Empty = Empty> {
  t: "List";
  v: Form<X>[];
}

export type List<X extends Empty = Empty> = ListBase<X> & X;

export function emptyList(l: Location): List<Location> {
  return { ...l, t: "List", v: [] };
}

export function isList<X extends Empty>(v: Form<X>): v is List<X> {
  return v.t === "List";
}

interface CallBase<X extends Empty = Empty> {
  t: "List";
  v: [CuSymbol<X> | PropertyAccess<X>, ...Form<X>[]];
}

export type Call<X extends Empty = Empty> = CallBase<X> & X;

export interface LiteralArrayBase<X extends Empty = Empty> {
  t: "Array";
  v: Form<X>[];
}

export type LiteralArray<X extends Empty = Empty> = LiteralArrayBase<X> & X;

export function isLiteralArray<X extends Empty = Empty>(v: Form<X>): v is LiteralArray<X> {
  return v.t === "Array";
}

export interface LiteralObjectBase<X extends Empty = Empty> {
  t: "Object";
  v: (KeyValue<X> | CuSymbol<X>)[];
}

export type LiteralObject<X extends Empty = Empty> = LiteralObjectBase<X> & X;

export function isLiteralObject<X extends Empty = Empty>(v: Form<X>): v is LiteralObject<X> {
  return v.t === "Object";
}

// TODO: Perhaps key should be either an Atom or LiteralArray;
export type KeyValue<X extends Empty = Empty> = [Form<X>, Form<X>];

// This is used to see the element of the LiteralObject, that's why its
// argument is `Form | KeyValue`, unlike the other is* functions.
export function isKeyValue<X extends Empty = Empty>(v: Form<X> | KeyValue<X>): v is KeyValue<X> {
  return Array.isArray(v);
}

// The `Cu` prefix is only to avoid conflicts with TypeScript's builtin types.
export type Atom<X extends Empty = Empty> =
  | LiteralInteger32<X>
  | LiteralFloat64<X>
  | LiteralString<X>
  | ReservedSymbol<X>
  | CuSymbol<X>
  | PropertyAccess<X>;

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

export type CuSymbol<X extends Empty = Empty> = {
  t: "Symbol";
  v: string;
} & X;

export function locatedCuSymbol(v: string, l: Location): CuSymbol<Location> {
  return { ...l, t: "Symbol", v };
}

export function cuSymbol(v: string): CuSymbol {
  return { t: "Symbol", v };
}

export function isCuSymbol<X extends Empty = Empty>(v: Form<X>): v is CuSymbol<X> {
  return v.t === "Symbol";
}

export type PropertyAccess<X extends Empty = Empty> = X & {
  t: "PropertyAccess";
  v: string[];
}

export function isPropertyAccess<X extends Empty = Empty>(v: Form<X>): v is PropertyAccess<X> {
  return v.t === "PropertyAccess";
}

export function showSymbolAccess(sym: CuSymbol | PropertyAccess): string {
  switch (sym.t) {
    case "Symbol":
      return sym.v;
    case "PropertyAccess":
      return sym.v.join(".");
    default:
      return expectNever(sym) as string;
  }
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
  switch (f.t) {
    case "List":
      return `\`(List${formatForErrorElement(f.v, formatForErrorShallow)})\``;
    case "Array":
      return `\`(Array${formatForErrorElement(f.v, formatForErrorShallow)})\``;
    case "Object":
      return `\`(Object${formatForErrorElement(f.v, formatForErrorKV)})\``;
    default:
      return formatForErrorAtom(f);
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

function formatForErrorKV(kv: KeyValue | CuSymbol): string {
  if (isKeyValue(kv)) {
    return `${formatForErrorShallow(kv[0])}: ${formatForErrorShallow(kv[1])}`;
  }
  return formatForErrorShallow(kv);
}

function formatForErrorShallow(f: Form): string {
  switch (f.t) {
    case "List":
      return `\`(List ..)\``;
    case "Array":
      return `\`(Array ..)\``;
    case "Object":
      return `\`(Object ..)\``;
    default:
      return formatForErrorAtom(f);
  }
}

function formatForErrorAtom(f: Atom): string {
  switch (f.t) {
    case "Integer32":
    case "Float64":
      return `\`(${f.t} ${f.v})\``;
    case "String":
      return `\`(String ${JSON.stringify(f.v)})\``;
    case "ReservedSymbol":
      return `\`(ReservedSymbol ${f.v === null ? "none" : f.v})\``;
    case "Symbol":
      return `\`(Symbol ${f.v})\``;
    case "PropertyAccess":
      return `\`(PropertyAccess ${f.v.join(".")})\``;
    default:
      throw ExpectNever(f);
  }
}

export type ProvidedSymbolsConfig = {
  // TODO: quoteされたFormにする。最終的にはProvidedSymbolsConfig全体を専用のマクロで設定する仕様に
  implicitStatements: string;
  modulePaths: ModulePaths;
  jsTopLevels: Id[];
};

export type CompleteProvidedSymbolsConfig = ProvidedSymbolsConfig & {
  from: FilePath;
};

export const ProvidedSymbolsConfig: s.Spec<ProvidedSymbolsConfig> = s.withId(
  "ProvidedSymbolsConfig",
  s.record({
    implicitStatements: s.string,
    modulePaths: s.map(s.string, s.string),
    jsTopLevels: s.array(s.string),
  }),
);

export type ModulePaths = Map<Id, FilePath>;

export type TranspileOptions = {
  srcPath: FilePath;
};

export function defaultTranspileOptions(): TranspileOptions {
  return { srcPath: process.cwd() };
}

export type Id = string;

export type FilePath = string;

export type JsModule = {
  readonly imports: JsSrc;
  readonly body: JsSrc;
};

export type JsModuleWithResult = JsModule & { lastExpression: JsSrc };

export type JsSrc = string;

export class TranspileError extends Error {
  override name = "TranspileError";

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isTranspileError = true;
  static is(e: unknown): e is TranspileError {
    return !!(e as Record<string, unknown>)?._cu$isTranspileError;
  }
}

export type Env<State extends TranspileState = TranspileState> = {
  readonly scopes: [Scope, ...Scope[]];
  readonly references: References; // References in the Progaram
  readonly modules: ModulePaths; // Mapping from module name to its path.
  readonly transpileState: State;
};

export type Scope = {
  isAsync: boolean;
  isGenerator: boolean;
  definitions: ModuleMap;
  temporaryVariablesCount: number;
};

export type ScopeOptions = Pick<Scope, "isAsync" | "isGenerator">;

export const defaultScopeOptions = { isAsync: false, isGenerator: false };

export const defaultAsyncScopeOptions = { isAsync: true, isGenerator: false };

// NOTE: I give up defining this as a unique symbol due to
// vite's behavior similar to https://github.com/vitejs/vite/issues/9528
const WriterKindKey = "_cu$WriterKind";
export interface AnyWriter<K extends number> {
  readonly [WriterKindKey]: K;
}

export function isWriter(x: unknown): x is Writer {
  return (
    x != null &&
    typeof x === "object" &&
    WriterKindKey in (x as Record<string, unknown>)
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

export type Module = { [id: Id]: Writer | unknown };

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
export type DirectWriterKindFlags = {
  statement: boolean;
  exportable: boolean;
};

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
export function aDynamicVar(call: DynamicVarFunction): DynamicVar {
  return { [WriterKindKey]: 8, call };
}
export function isDynamicVar(x: Writer): x is DynamicVar {
  return x[WriterKindKey] === 8;
}
export function markAsDynamicVar(call: DynamicVarFunction): DynamicVar {
  return { [WriterKindKey]: 8, call };
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
  | DynamicVar;

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

export type References = {
  readonly referenceById: Map<Id, Ref[]>;
  readonly currentScope: ScopePath;
  nextScope: ScopeIndex;
};

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

export type Ref = {
  readonly referer: ScopePath;
  readonly referee: ReferencePath;
};

export type ReferencePath = {
  scopePath: ScopePath; // Index of the every scope
  id: Id; // The variable name
};

export type ScopeIndex = number;

export type ScopePath = ScopeIndex[];
