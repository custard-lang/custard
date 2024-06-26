import { type Id, type JsSrc, type LiteralPropertyAccess } from "./types.js";

// _cu$ is the reserved prefix of Custard
export const CU_ENV = "_cu$env";

export function pseudoTopLevelAssignment(id: Id, exp: JsSrc): JsSrc {
  const idJson = JSON.stringify(id);
  const prefix = `void _cu$env.transpileState.topLevelValues.set(${idJson},`;
  return `${prefix}${exp})`;
}

export function pseudoTopLevelReference(id: Id): JsSrc {
  return `_cu$env.transpileState.topLevelValues.get(${JSON.stringify(id)})`;
}

export function pseudoTopLevelReferenceToPropertyAccess(
  id: LiteralPropertyAccess,
): JsSrc {
  const [id0, ...ids] = id.v;
  return `_cu$env.transpileState.topLevelValues.get(${JSON.stringify(
    id0,
  )}).${ids.join(".")}`;
}
