import { Scope } from "../types.js";
import { safe } from "./base/safe.js";
import { unbounded } from "./base/iteration/unbounded.js";
import { iteration } from "./base/iteration.js";

export function base(): Scope {
  const b = safe();
  for (const [id, f] of unbounded()) {
    b.set(id, f);
  }
  for (const [id, f] of iteration()) {
    b.set(id, f);
  }
  return b;
}
