import { Env } from "./internal/types.js";
import { expectNever } from "./util/error.js";

import { Awaitable } from "./util/types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Block = Form[];

export type Form = CuArray | Atom;

export type CuArray = Form[];

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

export type PropertyAccess = {
  t: "PropertyAccess";
  v: string[];
};

export type ProvidedSymbols = {
  initialScope: Scope;
  modulePaths: ModulePaths;
};

export function provideNoModules(initialScope: Scope): ProvidedSymbols {
  return {
    initialScope,
    modulePaths: new Map(),
  };
}

export type Scope = Map<Id, Writer>;

export type ModulePaths = Map<Id, FilePath>;

export type TranspileOptions = {
  srcPath: FilePath;
};

export function defaultTranspileOptions(): TranspileOptions {
  return { srcPath: process.cwd() };
}

export type Id = string;

export type FilePath = string;

export type JsSrc = string;

export type ContextualKeyword = { readonly t: 0; readonly companion: Id };
export function aContextualKeyword(companion: Id): ContextualKeyword {
  return { t: 0, companion };
}
export function isAContextualKeyword(x: Writer): x is ContextualKeyword {
  return (x as Record<string, unknown>).t === 0;
}

export type Var = { readonly t: 1 };
export function aVar(): Var {
  return { t: 1 };
}
export function isVar(x: Writer): x is Var {
  return (x as Record<string, unknown>).t === 1;
}

export type Const = { readonly t: 2 };
export function aConst(): Const {
  return { t: 2 };
}
export function isConst(x: Writer): x is Const {
  return (x as Record<string, unknown>).t === 2;
}

export type RecursiveConst = { readonly t: 3 };
export function aRecursiveConst(): RecursiveConst {
  return { t: 3 };
}
export function isRecursiveConst(x: Writer): x is RecursiveConst {
  return (x as Record<string, unknown>).t === 3;
}

export type Writer =
  | ContextualKeyword
  | Var
  | Const
  | RecursiveConst
  | ((env: Env, ...forms: CuArray) => Awaitable<JsSrc | TranspileError>);

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

export class TranspileError extends Error {
  override name = "TranspileError";
}

export type Call = [CuSymbol | PropertyAccess, ...Form[]];
