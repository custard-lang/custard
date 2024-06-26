export class KeyValues<K, V> {
  readonly #keyValues: Array<[K, V] | K>;

  constructor(keyValues: Array<[K, V] | K>) {
    this.#keyValues = keyValues;
  }

  entries(): IterableIterator<[K, V] | K> {
    return this.#keyValues[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<[K, V] | K> {
    return this.#keyValues[Symbol.iterator]();
  }
}
