import type { Empty } from "../../util/types.js";

export class CuString<X extends Empty = Empty> extends String {
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  public extension: X = {} as X;
}

export function cuString(v: string): CuString {
  return new CuString(v);
}

export function isCuString(v: unknown): v is CuString {
  return v instanceof CuString;
}
