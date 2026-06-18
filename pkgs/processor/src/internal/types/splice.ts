import type { Empty } from "../../util/types.js";

interface SpliceBrand {
  readonly _SpliceBrand: unique symbol;
}

class SpliceBase<T, X extends Empty = Empty> {
  extension = {} as X;

  constructor(public readonly value: T) {}
}

export interface Splice<T, X extends Empty = Empty>
  extends SpliceBase<T, X>,
    SpliceBrand {}

export function splice<T, X extends Empty = Empty>(value: T): Splice<T, X> {
  return new SpliceBase(value) as Splice<T, X>;
}

export function isSplice(v: unknown): v is Splice<unknown> {
  return v instanceof SpliceBase;
}
