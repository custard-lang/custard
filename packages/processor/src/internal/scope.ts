import { _cu$export, _cu$import, importAnyOf } from "./transpile/module.js";
import {
  aProvidedConst,
  ktvalOther,
  type Id,
  type JsSrc,
  type Ktvals,
  type Scope,
  type ScopeOptions,
  type Writer,
} from "./types.js";

export function init(options: ScopeOptions): Scope {
  return {
    isAsync: options.isAsync,
    isGenerator: options.isGenerator,
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
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  definitions.delete(id);
}

export function tmpVarOf(
  scope: Scope,
  exp: Ktvals<JsSrc>,
): { statement: Ktvals<JsSrc>; id: Id } {
  const id = `_cu$t$${scope.temporaryVariablesCount++}`;
  return {
    id,
    statement: [ktvalOther(`const ${id}=`), ...exp, ktvalOther(";\n")],
  };
}

export function addPrimitives(scope: Scope): void {
  set(scope, "import", _cu$import);
  set(scope, "importAnyOf", importAnyOf);
  set(scope, "export", _cu$export);
}

export function addProvidedConsts(scope: Scope, ids: Id[]): void {
  for (const id of ids) {
    set(scope, id, aProvidedConst());
  }
}
