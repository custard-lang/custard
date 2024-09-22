import type { Empty } from "../../util/types.js";

export class Integer32<X extends Empty = Empty> extends Number {
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  public extension: X = {} as X;
}

export function integer32(v: number): Integer32 {
  return new Integer32(v | 0);
}

export function isInteger32(v: unknown): v is Integer32 {
  return v instanceof Integer32;
}
