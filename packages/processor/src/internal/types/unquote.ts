import type { Empty } from "../../util/types.js";

interface UnquoteBrand {
  readonly _UnquoteBrand: unique symbol;
}

class UnquoteBase<T, X extends Empty = Empty> {
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  extension = {} as X;

  constructor(public readonly value: T) {}
}

export interface Unquote<T, X extends Empty = Empty>
  extends UnquoteBase<T, X>,
    UnquoteBrand {}

export function unquote<T, X extends Empty = Empty>(value: T): Unquote<T, X> {
  return new UnquoteBase(value) as Unquote<T, X>;
}

export function isUnquote(v: unknown): v is Unquote<unknown> {
  return v instanceof UnquoteBase;
}
