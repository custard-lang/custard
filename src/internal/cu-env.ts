import { extendBody } from "./transpile.js";
import { CuSymbol, JsModule, JsSrc, PropertyAccess } from "./types.js";

// _cu$ is the reserved prefix of Custard
export const CU_ENV = "_cu$env";

export function pseudoTopLevelAssignment(
  id: CuSymbol,
  exp: JsModule,
): JsModule {
  const prefix = `void _cu$env.transpileState.topLevelValues.set(${JSON.stringify(
    id.v,
  )},`;
  return extendBody(exp, prefix, ")");
}

export function pseudoTopLevelReference(id: CuSymbol): JsSrc {
  return `_cu$env.transpileState.topLevelValues.get(${JSON.stringify(id.v)})`;
}

export function pseudoTopLevelReferenceToPropertyAccess(
  id: PropertyAccess,
): JsSrc {
  const [id0, ...ids] = id.v;
  return `_cu$env.transpileState.topLevelValues.get(${JSON.stringify(
    id0,
  )}).${ids.join(".")}`;
}
