import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";

import { expectNever } from "../util/error.js";
import { Awaitable } from "../util/types.js";

import * as s from "../lib/spec.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Block = Form[];

export type Form = CuArray | LiteralArray | LiteralObject | Atom;

export type LiteralArray = { t: "LiteralArray"; v: CuArray };

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
  | Undefined
  | CuSymbol
  | PropertyAccess;

export type Integer32 = {
  t: "Integer32";
  v: number;
};

export type Float64 = number;

export type CuString = string;

export type Bool = boolean;

export type Undefined = undefined;

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
  src: Stats;
  srcPath: FilePath;
};

export async function defaultTranspileOptions(): Promise<TranspileOptions> {
  return await transpileOptionsFromPath(process.cwd());
}

export async function transpileOptionsFromPath(
  srcPath: FilePath,
): Promise<TranspileOptions> {
  return { srcPath, src: await stat(srcPath) };
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

export type Env<State = TranspileState> = {
  readonly scopes: [Scope, ...Scope[]];
  readonly references: References; // References in the Progaram
  readonly modules: ModulePaths; // Mapping from module name to its path.
  readonly transpileState: State;
};

export type Scope = {
  isAsync: boolean;
  definitions: Definitions;
  temporaryVariablesCount: number;
};

export type Definitions = Map<Id, Writer>;

// NOTE: I give up defining this as a unique symbol due to
// vite's behavior similar to https://github.com/vitejs/vite/issues/9528
const IsWriterKey = "_cu$IsWriter";
type IsWriter = { [IsWriterKey]: true };
function asWriter<T extends Record<string, unknown>>(x: T): IsWriter & T {
  return { ...x, [IsWriterKey]: true };
}
export function isWriter(x: unknown): x is Writer {
  return x != null && !!(x as Record<string, unknown>)[IsWriterKey];
}

export type ContextualKeyword = IsWriter & {
  readonly t: 0;
  readonly companion: Id;
};
export function aContextualKeyword(companion: Id): ContextualKeyword {
  return asWriter({ t: 0, companion });
}
export function isContextualKeyword(x: Writer): x is ContextualKeyword {
  return x.t === 0;
}

export type Var = IsWriter & { readonly t: 1 };
export function aVar(): Var {
  return asWriter({ t: 1 });
}
export function isVar(x: Writer): x is Var {
  return x.t === 1;
}

export type Const = IsWriter & { readonly t: 2 };
export function aConst(): Const {
  return asWriter({ t: 2 });
}
export function isConst(x: Writer): x is Const {
  return x.t === 2;
}

export type RecursiveConst = IsWriter & { readonly t: 3 };
export function aRecursiveConst(): RecursiveConst {
  return asWriter({ t: 3 });
}
export function isRecursiveConst(x: Writer): x is RecursiveConst {
  return x.t === 3;
}

export type Namespace = IsWriter & {
  readonly t: 4;
  readonly definitions: Definitions;
};
export function aNamespace(): Namespace {
  return asWriter({ t: 4, definitions: new Map() });
}
export function isNamespace(x: Writer): x is Namespace {
  return x.t === 4;
}

export type DirectWriter = (
  env: Env,
  ...forms: CuArray
) => Awaitable<JsSrc | TranspileError>;
export type MarkedDirectWriter = IsWriter & {
  readonly t: 5;
  readonly call: DirectWriter;
  readonly isStatement: boolean;
};
export type DirectWriterKind = "statement" | "expression";
export function markAsDirectWriter(
  call: DirectWriter,
  kind: DirectWriterKind = "expression",
): MarkedDirectWriter {
  return asWriter({ t: 5, call, isStatement: kind === "statement" });
}
export function isMarkedDirectWriter(x: Writer): x is MarkedDirectWriter {
  return x.t === 5;
}
export function isMarkedDirectStatementWriter(
  x: Writer,
): x is MarkedDirectWriter {
  return x.t === 5 && x.isStatement;
}

export type FunctionWithEnv = (env: Env, ...rest: any[]) => any | Error;
export type MarkedFunctionWithEnv = IsWriter & {
  readonly t: 6;
  readonly call: FunctionWithEnv;
};
export function markAsFunctionWithEnv(
  call: FunctionWithEnv,
): MarkedFunctionWithEnv {
  return asWriter({ t: 6, call });
}
export function isMarkedFunctionWithEnv(x: Writer): x is MarkedFunctionWithEnv {
  return x.t === 6;
}

export type ProvidedConst = IsWriter & { readonly t: 7 };
export function aProvidedConst(): ProvidedConst {
  return asWriter({ t: 7 });
}
export function isProvidedConst(x: Writer): x is ProvidedConst {
  return x.t === 7;
}

export type Writer =
  | ContextualKeyword
  | Var
  | Const
  | RecursiveConst
  | Namespace
  | MarkedDirectWriter
  | MarkedFunctionWithEnv
  | ProvidedConst;

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
