import { Scope, Env, Id, isRecursiveConst, TranspileError, Writer } from "./types.js";
import * as References from "./references.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";

export function init(initial: Scope): Env {
  return {
    s: [initial],
    r: References.init(),
  };
}

export function find({ s } : Env, id: Id): Writer | undefined {
  for (const frame of s.values()) {
    const result = frame.get(id);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export function referTo({ s, r } : Env, id: Id): Writer | TranspileError {
  for (const [i, frame] of s.entries()) {
    const result = frame.get(id);
    if (result !== undefined) {
      const s = r.p.slice(i);
      References.add(r, { i: id, s });
      return result;
    }
  }
  return new TranspileError(`No variable \`${id}\` is defined! NOTE: If you want to define \`${id}\` recursively, wrap the declaration(s) with \`recursive\`.`);
}

export function isDefinedInThisScope({ s }: Env, id: Id): boolean {
  const w = s[0].get(id);
  return w !== undefined && !isRecursiveConst(w);
}

export function set({ s, r: { m, p } }: Env, id: Id, writer: Writer): undefined | TranspileError {
  const rs = m.get(id) || [];
  if (rs.some((r) => isDeeperThanOrEqual(r.r, p) && isShallowerThan(r.e.s, p))) {
    return new TranspileError(
      `No variable \`${id}\` is defined! NOTE: If you want to define \`${id}\` recursively, wrap the declaration(s) with \`recursive\`.`
    );
  }
  s[0].set(id, writer);
}

export function push({ s, r }: Env): void {
  References.appendNewScope(r);
  s.unshift(new Map());
}

export function pop({ s, r }: Env): void {
  References.returnToPreviousScope(r);
  s.shift();
}
