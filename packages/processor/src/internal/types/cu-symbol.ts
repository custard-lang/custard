import type { Empty } from "../../util/types.js";

export class CuSymbol<X extends Empty = Empty> {
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  public extension: X = {} as X;

  constructor(public readonly value: string) {}
}

export function cuSymbol(v: string): CuSymbol {
  return new CuSymbol(v);
}

export function isCuSymbol(v: unknown): v is CuSymbol {
  return v instanceof CuSymbol;
}
