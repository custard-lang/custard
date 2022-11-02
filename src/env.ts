import { Definitions, Env, Id, isRecursiveConst, TranspileError, Writer } from "./types.js";

export function init(initial: Definitions): Env {
  return [{ d: initial, o: new Set() }];
}

export function find(env: Env, id: Id): Writer | undefined {
  for (const frame of env) {
    const result = frame.d.get(id);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export function findWithScopeOffset(
  env: Env,
  id: Id
): [Writer, number] | undefined {
  for (const [i, frame] of env.entries()) {
    const result = frame.d.get(id);
    if (result !== undefined) {
      return [result, i];
    }
  }
  return undefined;
}

export function isDefinedInThisScope(env: Env, id: Id): boolean {
  const w = env[0].d.get(id);
  return w !== undefined && !isRecursiveConst(w);
}

export function set(env: Env, id: Id, writer: Writer): undefined | TranspileError {
  if (env[0].o.has(id)) {
    return new TranspileError(""); // TODO
  }
  env[0].d.set(id, writer);
}

export function push(env: Env): void {
  env.unshift({ d: new Map(), o: new Set() });
}

export function pop(env: Env): void {
  env.shift();
}

export function rememberOuterFunctionIsReferred(env: Env, id: Id): void {
  env[0].o.add(id);
}
