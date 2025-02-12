import type { Empty } from "../../util/types.js";

// Looks like false positive
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export class Float64<X extends Empty = Empty> extends Number {
  public extension: X = {} as X;
}

export function float64(v: number): Float64 {
  return new Float64(v);
}

export function isFloat64(v: unknown): v is Float64 {
  return v instanceof Float64;
}
