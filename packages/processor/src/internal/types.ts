import { expectNever } from "../util/error.js";
import { Awaitable } from "../util/types.js";

import * as s from "../lib/spec.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Block = Form[];

export type Form = CuArray | LiteralArray | LiteralObject | Atom;

export type LiteralArray = { t: "LiteralArray"; v: CuArray };

export function isLiteralArray(v: Form): v is LiteralArray {
  return v !== undefined && (v as Record<string, unknown>).t === "LiteralArray";
}

export type CuArray = Form[];

export type LiteralObject = {
  t: "LiteralObject";
  v: (KeyValue | CuSymbol)[];
};

export function isLiteralObject(v: Form): v is LiteralObject {
  return (
    v !== undefined && (v as Record<string, unknown>).t === "LiteralObject"
  );
}

// TODO: Perhaps key should be either an Atom or Call;
export type KeyValue = [Form, Form];

// The `Cu` prefix is only to avoid conflicts with TypeScript's builtin types.
export type Atom =
  | Integer32
  | Float64
  | CuString
  | Bool
  | None
  | CuSymbol
  | PropertyAccess;

export type Integer32 = {
  t: "Integer32";
  v: number;
};

export type Float64 = number;

export type CuString = string;

export type Bool = boolean;

export type None = undefined;

export type CuSymbol = {
  t: "Symbol";
  v: string;
};

export function cuSymbol(v: string): CuSymbol {
  return { t: "Symbol", v };
}

export type PropertyAccess = {
  t: "PropertyAccess";
  v: string[];
};

export function isCuSymbol(v: Form): v is CuSymbol {
  return v !== undefined && (v as Record<string, unknown>).t === "Symbol";
}

export function isPropertyAccess(v: Form): v is PropertyAccess {
  return (
    v !== undefined && (v as Record<string, unknown>).t === "PropertyAccess"
  );
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

export type Call = [CuSymbol | PropertyAccess, ...Form[]];

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
  ...forms: CuArray
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
