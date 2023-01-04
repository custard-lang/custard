import type { Scope } from "./types.js";

export function merge(s0: () => Scope, ...ss: (() => Scope)[]): Scope {
  const s = s0();
  for (const s1 of ss) {
    for (const [id, v] of s1()) {
      s.set(id, v);
    }
  }
  return s;
}
