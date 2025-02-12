import { type Empty } from "../../util/types.js";

export class List<T, X extends Empty = Empty> {
  constructor(
    public values: T[],
    public extension: X = {} as X,
  ) {}

  [Symbol.iterator](): IterableIterator<T> {
    return this.values[Symbol.iterator]();
  }
}

export function list<T>(...v: T[]): List<T> {
  return new List(v);
}

export function isList(v: unknown): v is List<unknown> {
  return v instanceof List;
}
