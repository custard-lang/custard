import { concatJsModules, jsModuleOfBody } from "./transpile.js";
import { _cu$import, importAnyOf } from "./transpile/module.js";
import { aConst, Id, JsModule, Scope, Writer } from "./types.js";

export function init(): Scope {
  return {
    isAsync: false,
    definitions: new Map(),
    temporaryVariablesCount: 0,
  };
}

export function initAsync(): Scope {
  return {
    isAsync: true,
    definitions: new Map(),
    temporaryVariablesCount: 0,
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

export function tmpVarOf(
  scope: Scope,
  exp: JsModule,
): { statement: JsModule; id: Id } {
  const id = `_cu$t$${scope.temporaryVariablesCount++}`;
  return {
    id,
    statement: concatJsModules(
      jsModuleOfBody(`const ${id}=`),
      exp,
      jsModuleOfBody(";\n"),
    ),
  };
}

export function addPrimitives(scope: Scope): void {
  set(scope, "import", _cu$import);
  set(scope, "importAnyOf", importAnyOf);
}

export function addConsts(scope: Scope, ids: Id[]): void {
  for (const id of ids) {
    set(scope, id, aConst());
  }
}
