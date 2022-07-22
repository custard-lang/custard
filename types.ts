export type Form = CuArray | Atom;

export type CuArray = Form[];

// The `Cu` prefix is only to avoid conflicts with TypeScript's builtin types.
export type Atom = Integer32 | Float64 | CuString | Bool | None | CuSymbol;

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

export type Env = Scope[];

export type Scope = Map<Id, Writer>;

export type Id = string;

export type JsSrc = string;

export type Writer = (env: Env, ...forms: CuArray) => JsSrc | TranspileError;

export function isCuSymbol(v: Form): v is CuSymbol {
  return (v as CuSymbol).t === "Symbol";
}

export class TranspileError extends Error {
  override name = "TranspileError";
}
