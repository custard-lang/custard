import { loadAsScope } from "../module.js";
import { aConst, ProvidedSymbolsConfig, Scope } from "../types.js";

export async function fromProvidedSymbolsConfig({
  builtinModulePaths,
  jsTopLevels,
}: ProvidedSymbolsConfig): Promise<Scope> {
  const scope = await loadAsScope(builtinModulePaths);
  for (const jsId of jsTopLevels) {
    scope.set(jsId, aConst());
  }
  return scope;
}
