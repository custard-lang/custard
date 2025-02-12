import type { Empty } from "../../util/types.js";
import type { CuString } from "./cu-string.js";
import type { CuSymbol } from "./cu-symbol.js";
import type { Unquote } from "./unquote.js";

export class KeyValue<V, A = unknown, U = unknown, X extends Empty = Empty> {
  constructor(
    public key: KeyValueKey<A, U, X>,
    public value: V,
  ) {}
}

interface ComputedKeyBrand {
  readonly _ComputedKeyBrand: unique symbol;
}

class ComputedKeyBase<T> {
  constructor(public readonly value: T) {}
}
export interface ComputedKey<T> extends ComputedKeyBase<T>, ComputedKeyBrand {}

export type KeyValueKey<C = unknown, U = unknown, X extends Empty = Empty> =
  | CuSymbol<X>
  | CuString<X>
  | ComputedKey<C>
  | Unquote<U, X>;

export function keyValue<V, A, U, X extends Empty = Empty>(
  key: KeyValueKey<A, U, X>,
  value: V,
): KeyValue<V, A, U, X> {
  return new KeyValue(key, value);
}

export function isKeyValue(v: unknown): v is KeyValue<unknown> {
  return v instanceof KeyValue;
}

export function computedKey<T>(key: T): ComputedKey<T> {
  return new ComputedKeyBase(key) as ComputedKey<T>;
}

export function isComputedKey(v: unknown): v is ComputedKey<unknown> {
  return v instanceof ComputedKeyBase;
}
