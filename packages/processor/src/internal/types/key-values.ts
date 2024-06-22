export class KeyValues<K, V> {
  #keyValues: ([K, V] | K)[];

  constructor(keyValues: ([K, V] | K)[]) {
    this.#keyValues = keyValues;
  }

  entries(): IterableIterator<[K, V] | K> {
    return this.#keyValues[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<[K, V] | K> {
    return this.#keyValues[Symbol.iterator]();
  }
}
