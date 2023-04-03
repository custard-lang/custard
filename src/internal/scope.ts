import { Definitions, Id, Scope, Writer } from "./types.js";

export function init(): Scope {
  return {
    isAsync: false,
    definitions: new Map(),
  };
}

export function initAsync(): Scope {
  return {
    isAsync: true,
    definitions: new Map(),
  };
}

export function fromDefinitions(definitions: Definitions): Scope {
  return {
    isAsync: false,
    definitions,
  };
}

export function set({ definitions }: Scope, id: Id, writer: Writer): void {
  definitions.set(id, writer);
}

export function get({ definitions }: Scope, id: Id): Writer | undefined {
  return definitions.get(id);
}

export function destroy({ definitions }: Scope, id: Id): void {
  // I just want to delete, so I don't have to use the result.
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  definitions.delete(id);
}
