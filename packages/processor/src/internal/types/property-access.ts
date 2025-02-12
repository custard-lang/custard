import type { Empty } from "../../util/types.js";

export class PropertyAccess<X extends Empty = Empty> {
  public extension: X = {} as X;

  constructor(public readonly value: [string, ...string[]]) {}
}

export function propertyAccess(...v: [string, ...string[]]): PropertyAccess {
  return new PropertyAccess(v);
}

export function isPropertyAccess(v: unknown): v is PropertyAccess {
  return v instanceof PropertyAccess;
}
