import type { Empty } from "../../util/types.js";

interface Float64Brand {
  readonly _Float64Brand: unique symbol;
}

// Looks like false positive
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
class Float64Base<X extends Empty = Empty> extends Number {
  public extension: X = {} as X;
}

export interface Float64<X extends Empty = Empty>
  extends Float64Base<X>,
    Float64Brand {}

export function float64(v: number): Float64 {
  return new Float64Base(v) as Float64;
}

export function isFloat64(v: unknown): v is Float64 {
  return v instanceof Float64Base;
}
