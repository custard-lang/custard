import { loadModulePaths } from "./internal/definitions.js";
import { aConst, Definitions } from "./internal/types.js";
import { ProvidedSymbolsConfig } from "./types.js";

export {
  standardModuleRoot,
  loadModulePathInto,
} from "./internal/definitions.js";

export async function fromProvidedSymbolsConfig({
  builtinModulePaths,
  jsTopLevels,
}: ProvidedSymbolsConfig): Promise<Definitions> {
  const definitions = await loadModulePaths(builtinModulePaths);
  for (const jsId of jsTopLevels) {
    definitions.set(jsId, aConst());
  }
  return definitions;
}
