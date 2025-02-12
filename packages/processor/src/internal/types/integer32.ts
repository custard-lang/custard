import type { Empty } from "../../util/types.js";

// Looks like false positive
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export class Integer32<X extends Empty = Empty> extends Number {
  public extension: X = {} as X;
}

export function integer32(v: number): Integer32 {
  return new Integer32(v | 0);
}

export function isInteger32(v: unknown): v is Integer32 {
  return v instanceof Integer32;
}
