import { loadModulePaths } from "./internal/definitions.js";
import { aConst, Definitions, TranspileError } from "./internal/types.js";
import { ProvidedSymbolsConfig } from "./types.js";

export {
  standardModuleRoot,
  loadModulePathInto,
} from "./internal/definitions.js";

export async function fromProvidedSymbolsConfig({
  builtinModulePaths,
  jsTopLevels,
}: ProvidedSymbolsConfig): Promise<Definitions | TranspileError> {
  const definitions = await loadModulePaths(builtinModulePaths);
  if (definitions instanceof TranspileError) {
    return definitions;
  }
  for (const jsId of jsTopLevels) {
    definitions.set(jsId, aConst());
  }
  return definitions;
}
