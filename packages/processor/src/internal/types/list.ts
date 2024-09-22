import { type Empty } from "../../util/types.js";

export class List<T, X extends Empty = Empty> {
  constructor(values: T[]);
  constructor(values: T[], extension: X);
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
