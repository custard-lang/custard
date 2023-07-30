export function mergeFromTo<K, V>(from: Map<K, V>, to: Map<K, V>): void {
  for (const [k, v] of from) {
    to.set(k, v);
  }
}
