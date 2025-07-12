import type { Empty } from "../../util/types.js";

interface Integer32Brand {
  readonly _Integer32Brand: unique symbol;
}

// Looks like false positive
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
class Integer32Base<X extends Empty = Empty> extends Number {
  public extension: X = {} as X;
}

export interface Integer32<X extends Empty = Empty>
  extends Integer32Base<X>,
    Integer32Brand {}

export function integer32(v: number): Integer32 {
  return new Integer32Base(v | 0) as Integer32;
}

export function isInteger32(v: unknown): v is Integer32 {
  return v instanceof Integer32Base;
}
