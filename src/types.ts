export type Block = Form[];

export type Form = CuArray | Atom;

export type CuArray = Form[];

// The `Cu` prefix is only to avoid conflicts with TypeScript's builtin types.
export type Atom = Integer32 | Float64 | CuString | Bool | Undefined | CuSymbol;

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

export type Env = {
  readonly s: [Scope, ...Scope[]]; // Scopes
  readonly r: References; // References in the Progaram
  readonly m: ModulePaths; // Mapping from module name to its path.
};

export type Scope = Map<Id, Writer>;

export type ModulePaths = Map<Id, Path>;

export type Id = string;

export type Path = string;

export type References = {
  // Mapping of Scopes to Variables
  readonly m: Map<Id, Ref[]>;
  // Path to Current Scope
  readonly p: ScopePath;
  // Next ScopeIndex
  n: ScopeIndex;
};

export type Ref = {
  readonly r: ScopePath; // Referer
  readonly e: ReferencePath; // Referee
};

export type ReferencePath = {
  s: ScopePath; // Index of the every scope
  i: Id; // The variable name
};

export type ScopeIndex = number;

export type ScopePath = ScopeIndex[];

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
  | ((env: Env, ...forms: CuArray) => JsSrc | TranspileError);

export function isCuSymbol(v: Form): v is CuSymbol {
  return v !== undefined && (v as CuSymbol).t === "Symbol";
}

export class TranspileError extends Error {
  override name = "TranspileError";
}

export type Call = [CuSymbol, ...Form[]];
