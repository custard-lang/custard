import type { Empty } from "../../util/types.js";
import { Id } from "./id.js";

export class PropertyAccess<T, X extends Empty = Empty> {
  public readonly left: T;
  public readonly right: Id;
  public extension: X = {} as X;

  constructor(left: T, right: Id) {
    this.left = left;
    this.right = right;
  }
}

export function propertyAccess<T>(left: T, right: Id): PropertyAccess<T> {
  return new PropertyAccess(left, right);
}

export function isPropertyAccess(v: unknown): v is PropertyAccess<unknown> {
  return v instanceof PropertyAccess;
}
