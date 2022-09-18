import { Scope } from "../types.js";
import { safe } from "./base/safe.js";
import { unbounded } from "./base/iteration/unbounded.js";

export function base(): Scope {
  const b = safe();
  for (const [id, f] of unbounded()) {
    b.set(id, f);
  }
  return b;
}
