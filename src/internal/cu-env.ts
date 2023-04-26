import * as EnvF from "./env.js";
import * as ScopeF from "./scope.js";
import {
  aConst,
  cuSymbol,
  CuSymbol,
  Env,
  JsSrc,
  PropertyAccess,
} from "./types.js";

// _cu$ is the reserved prefix of Custard
export const CU_ENV = "_cu$env";

export async function enablingCuEnv<T>(
  env: Env,
  f: (cuEnv: CuSymbol) => Promise<T>,
): Promise<T> {
  // TODO: I'm currently not sure how to handle the _cu$env variable here.
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  EnvF.set(env, CU_ENV, aConst());
  try {
    return await f(cuSymbol(CU_ENV));
  } finally {
    ScopeF.destroy(env.scopes[0], CU_ENV);
  }
}

export function pseudoTopLevelAssignment(id: CuSymbol, exp: JsSrc): JsSrc {
  return `void _cu$env.transpileState.topLevelValues.set(${JSON.stringify(
    id.v,
  )}, ${exp})`;
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
