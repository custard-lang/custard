import type { Empty } from "../../util/types.js";

export class PropertyAccess<X extends Empty = Empty> {
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  public extension: X = {} as X;

  constructor(public readonly value: string[]) {}
}

export function propertyAccess(...v: string[]): PropertyAccess {
  return new PropertyAccess(v);
}

export function isPropertyAccess(v: unknown): v is PropertyAccess {
  return v instanceof PropertyAccess;
}
