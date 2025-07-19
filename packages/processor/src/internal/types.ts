import { ExpectNever } from "../util/error.js";
import { type Awaitable, type Empty } from "../util/types.js";

import * as s from "../lib/spec.js";
import { type List, isList, list } from "./types/list.js";
import { type CuArray, cuArray, isCuArray } from "./types/cu-array.js";
import { CuObject, cuObject, isCuObject } from "./types/cu-object.js";
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
import {
  type ComputedKey,
  isComputedKey,
  isKeyValue,
  type KeyValue,
  keyValue,
  type KeyValueKey,
  computedKey,
} from "./types/key-value.js";
import { type Id } from "./types/id.js";
import { type Ktvals } from "./types/ktval.js";

export * from "./types/ktval.js";
export * from "./types/id.js";

export type Block<X extends Empty = Empty> = Array<Form<X>>;

export type Form<X extends Empty = Empty> =
  | List<Form<X>, X>
  | CuArray<Form<X>, X>
  | CuObject<Form<X>, Form<X>, Form<X>, Form<X>, X>
  | Atom<X>
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
  >,
  l: Location,
): CuObject<
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
  extends List<Form<X>, X>,
    ValidCallBrand {}

export function isValidCall<X extends Empty = Empty>(v: Form<X>): v is Call<X> {
  return (
    isList(v) &&
    v.values.length > 0 &&
    (isCuSymbol(v.values[0]) || isPropertyAccess(v.values[0]))
  );
}

export function functionIdOfCall<X extends Empty = Empty>(
  v: Call<X>,
): CuSymbol<X> {
  return v.values[0] as CuSymbol<X>;
}

// The `Cu` prefix is only to avoid conflicts with TypeScript's builtin types.
export type Atom<X extends Empty = Empty> =
  | Integer32<X>
  | Float64<X>
  | CuString<X>
  | ReservedSymbol<X>
  | CuSymbol<X>
  | PropertyAccess<X>;

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
  v: [string, ...string[]],
  l: Location,
): PropertyAccess<Location> {
  const p = propertyAccess(...v);
  p.extension = l;
  return p as PropertyAccess<Location>;
}

export function showSymbolAccess(sym: CuSymbol | PropertyAccess): string {
  if (isCuSymbol(sym)) {
    return sym.value;
  }
  return sym.value.join(".");
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

export interface ReaderInput {
  readonly path: FilePath;
  readonly contents: string;
  readonly initialLineNumber: number;
}

export function readerInput(
  path: FilePath,
  contents: string,
  initialLineNumber = 1,
): ReaderInput {
  return { path, contents, initialLineNumber };
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

export function formatForError(f: Form | ComputedKey<Form>): string {
  return `\`${formatForErrorUnticked(f)}\``;
}

function formatForErrorUnticked(f: Form | ComputedKey<Form>): string {
  if (isList(f)) {
    return `(List${formatForErrorElement(f.values, formatForErrorShallow)})`;
  }
  if (isCuArray(f)) {
    return `(Array${formatForErrorElement(f, formatForErrorShallow)})`;
  }
  if (isCuObject(f)) {
    return `(Object${formatForErrorElement(f.keyValues, formatForErrorKV)})`;
  }
  if (isComputedKey(f)) {
    return `(ComputedKey ${formatForErrorShallow(f.value)})`;
  }
  return formatForErrorEtc(f);
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
  kv: KeyValue<Form, Form, Form> | CuSymbol | Unquote<Form>,
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

function formatForErrorShallow(f: Form): string {
  if (isList(f)) {
    return `(List ..)`;
  }
  if (isCuArray(f)) {
    return `(Array ..)`;
  }
  if (isCuObject(f)) {
    return `(Object ..)`;
  }
  return formatForErrorEtc(f);
}

function formatForErrorEtc(f: Atom | Unquote<Form> | Splice<Form>): string {
  if (isInteger32(f)) {
    return `(Integer32 ${String(f)})`;
  }
  if (isFloat64(f)) {
    return `(Float64 ${String(f)})`;
  }
  if (isCuString(f)) {
    return `(String ${JSON.stringify(f)})`;
  }
  if (isReservedSymbol(f)) {
    return `(ReservedSymbol ${f.valueOf() ?? "none"})`;
  }
  if (isCuSymbol(f)) {
    return `(Symbol ${f.value})`;
  }
  if (isPropertyAccess(f)) {
    return `(PropertyAccess ${f.value.join(".")})`;
  }
  if (isUnquote(f)) {
    return `$${formatForErrorUnticked(f.value)}`;
  }
  if (isSplice(f)) {
    return `..${formatForErrorUnticked(f.value)}`;
  }
  throw ExpectNever(f);
}

export function jsValueToForm(v: unknown): Form | TranspileError {
  if (
    isInteger32(v) ||
    isFloat64(v) ||
    isCuString(v) ||
    isReservedSymbol(v) ||
    isCuSymbol(v) ||
    isPropertyAccess(v)
  ) {
    return v;
  }

  if (v === null || typeof v === "boolean") {
    return reservedSymbol(v);
  }
  if (v === undefined) {
    return reservedSymbol(null);
  }
  if (typeof v === "number") {
    return float64(v);
  }
  if (typeof v === "string") {
    return cuString(v);
  }

  if (isList(v)) {
    const r = list<Form>();
    for (const item of v) {
      const f = jsValueToForm(item);
      if (TranspileError.is(f)) {
        return f;
      }
      r.values.push(f);
    }
    return r;
  }

  if (Array.isArray(v)) {
    const r = cuArray<Form>();
    for (const item of v) {
      const f = jsValueToForm(item);
      if (TranspileError.is(f)) {
        return f;
      }
      r.push(f);
    }
    return r;
  }

  if (isCuObject(v)) {
    const r = cuObject<Form, Form, Form, Form>();
    for (const keyValueOrSymbolOrUnquote of v) {
      if (isKeyValue(keyValueOrSymbolOrUnquote)) {
        let key: KeyValueKey<Form, Form>;
        if (isComputedKey(keyValueOrSymbolOrUnquote.key)) {
          const computed = jsValueToForm(keyValueOrSymbolOrUnquote.key.value);
          if (TranspileError.is(computed)) {
            return computed;
          }
          key = computedKey(computed);
        } else {
          const keyTmp = jsValueToForm(keyValueOrSymbolOrUnquote.key);
          if (TranspileError.is(keyTmp)) {
            return keyTmp;
          }
          key = keyTmp as KeyValueKey<Form, Form>;
        }

        const value = jsValueToForm(keyValueOrSymbolOrUnquote.value);
        if (TranspileError.is(value)) {
          return value;
        }
        r.keyValues.push(keyValue(key, value));
        continue;
      }
      const f = jsValueToForm(keyValueOrSymbolOrUnquote.value);
      if (TranspileError.is(f)) {
        return f;
      }
      r.keyValues.push(unquote(f));
    }
    return r;
  }

  if (isUnquote(v)) {
    const unquoted = jsValueToForm(v.value);
    if (TranspileError.is(unquoted)) {
      return unquoted;
    }
    return unquote(unquoted);
  }

  if (isSplice(v)) {
    const spliced = jsValueToForm(v.value);
    if (TranspileError.is(spliced)) {
      return spliced;
    }
    return splice(spliced);
  }

  if (v instanceof Function || v instanceof Promise || typeof v === "symbol") {
    return new TranspileError(
      `Cannot convert a ${v.constructor.name} to a Form.`,
    );
  }

  // Ordinary objects
  const r = cuObject<Form, Form, Form, Form>();
  for (const [key, value] of Object.entries(v)) {
    const keyForm = jsValueToForm(key);
    if (TranspileError.is(keyForm)) {
      return keyForm;
    }
    const valueForm = jsValueToForm(value);
    if (TranspileError.is(valueForm)) {
      return valueForm;
    }
    r.keyValues.push(keyValue(keyForm as CuString, valueForm));
  }
  return r;
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

export type FilePath = string;

export interface JsModule {
  readonly imports: Ktvals<JsSrc>;
  readonly body: Ktvals<JsSrc>;
}

export type JsSrc = string;

export class TranspileError extends Error {
  override name = "TranspileError";

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isTranspileError = true;
  static is(e: unknown): e is TranspileError {
    return !!((e as { [key: string]: unknown } | null)
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
  isTopLevel: boolean;
}

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
) => Awaitable<Ktvals<JsSrc> | TranspileError>;
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
) => Awaitable<Ktvals<JsSrc> | TranspileError>;

export interface DynamicVar extends AnyWriter<8> {
  call: DynamicVarFunction;
}
export function isDynamicVar(x: Writer): x is DynamicVar {
  return x[WriterKindKey] === 8;
}
export function markAsDynamicVar(call: DynamicVarFunction): DynamicVar {
  return { [WriterKindKey]: 8, call };
}

// This must receive literally any values by definition.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MacroBody = (...xs: any[]) => Awaitable<any | TranspileError>;

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

export interface TranspileStateCore {
  transpiledSrc: Ktvals<JsSrc>;
  evaluatedUpTo: number;
  currentBlockIndex: number;
  topLevelValues: TopLevelValues;
  // ^ When transpiling into the module it's used for macro,
  //   while in the REPL, it is used for both macro and the REPL session.
}

export interface TranspileRepl extends TranspileStateCore, TranspileOptions {
  mode: "repl";
}

export interface TranspileModule extends TranspileStateCore, TranspileOptions {
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
