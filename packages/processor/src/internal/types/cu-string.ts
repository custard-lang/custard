import type { Empty } from "../../util/types.js";

// Looks like false positive
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export class CuString<X extends Empty = Empty> extends String {
  public extension: X = {} as X;
}

export function cuString(v: string): CuString {
  return new CuString(v);
}

export function isCuString(v: unknown): v is CuString {
  return v instanceof CuString;
}
