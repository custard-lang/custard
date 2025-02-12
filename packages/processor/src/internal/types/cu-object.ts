import type { Empty } from "../../util/types.js";
import type { CuSymbol } from "./cu-symbol.js";
import type { KeyValue } from "./key-value.js";
import type { Unquote } from "./unquote.js";

export class CuObject<
  V,
  KU = unknown,
  KA = unknown,
  U = unknown,
  X extends Empty = Empty,
> {
  constructor(
    public keyValues: Array<
      KeyValue<V, KU, KA, X> | CuSymbol<X> | Unquote<U, X>
    >,
    public extension: X = {} as X,
  ) {}

  [Symbol.iterator](): IterableIterator<
    KeyValue<V, KU, KA, X> | CuSymbol<X> | Unquote<U, X>
  > {
    return this.keyValues[Symbol.iterator]();
  }
}

export function cuObject<V, KU, KA, U, X extends Empty = Empty>(
  ...v: Array<KeyValue<V, KU, KA, X> | CuSymbol<X> | Unquote<U, X>>
): CuObject<V, KU, KA, U, X> {
  return new CuObject<V, KU, KA, U, X>(v, {} as X);
}

export function isCuObject(v: unknown): v is CuObject<unknown> {
  return v instanceof CuObject;
}
