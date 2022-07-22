import { Env, Id, Writer } from "./types.js";

export function init(initial: Map<Id, Writer>): Env {
  return [initial];
}

export function find(env: Env, id: Id): Writer | undefined {
  for (const frame of env) {
    const result = frame.get(id);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export function set(env: Env, id: Id, writer: Writer): void {
  env[0]!.set(id, writer);
}

export function push(env: Env): void {
  env.unshift(new Map());
}

export function pop(env: Env): void {
  env.shift();
}
