import type { Empty } from "../../util/types.js";

export class CuSymbol<X extends Empty = Empty> {
  public extension: X = {} as X;

  constructor(public readonly value: string) {}
}

export function cuSymbol(v: string): CuSymbol {
  return new CuSymbol(v);
}

export function isCuSymbol(v: unknown): v is CuSymbol {
  return v instanceof CuSymbol;
}
