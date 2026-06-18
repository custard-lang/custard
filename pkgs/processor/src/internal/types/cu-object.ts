import type { Empty } from "../../util/types.js";
import type { CuSymbol } from "./cu-symbol.js";
import type { KeyValue } from "./key-value.js";
import { Splice } from "./splice.js";
import type { Unquote } from "./unquote.js";

export class CuObject<
  V,
  KU = unknown,
  KC = unknown,
  U = unknown,
  S = unknown,
  X extends Empty = Empty,
> {
  constructor(
    public keyValues: Array<
      KeyValue<V, KU, KC, X> | CuSymbol<X> | Unquote<U, X> | Splice<S, X>
    >,
    public extension: X = {} as X,
  ) {}

  [Symbol.iterator](): IterableIterator<
    KeyValue<V, KU, KC, X> | CuSymbol<X> | Unquote<U, X> | Splice<S, X>
  > {
    return this.keyValues[Symbol.iterator]();
  }
}

export function cuObject<V, KU, KC, U, S, X extends Empty = Empty>(
  ...v: Array<
    KeyValue<V, KU, KC, X> | CuSymbol<X> | Unquote<U, X> | Splice<S, X>
  >
): CuObject<V, KU, KC, U, S, X> {
  return new CuObject<V, KU, KC, U, S, X>(v, {} as X);
}

export function isCuObject(v: unknown): v is CuObject<unknown> {
  return v instanceof CuObject;
}
