import type { Empty } from "../../util/types.js";

export class Float64<X extends Empty = Empty> extends Number {
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  public extension: X = {} as X;
}

export function float64(v: number): Float64 {
  return new Float64(v);
}

export function isFloat64(v: unknown): v is Float64 {
  return v instanceof Float64;
}
