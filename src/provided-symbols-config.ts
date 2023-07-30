import * as path from "node:path";

import { FilePath, ProvidedSymbolsConfig } from "./types.js";

export function implicitlyImporting(
  ...builtinModulePaths: FilePath[]
): ProvidedSymbolsConfig {
  let implicitStatements = "";
  const modulePaths: Map<string, string> = new Map();

  for (const modulePath of builtinModulePaths) {
    const moduleName = path.basename(modulePath, path.extname(modulePath));
    implicitStatements = `${implicitStatements}(importAnyOf ${moduleName})`;
    modulePaths.set(moduleName, modulePath);
  }

  return {
    implicitStatements,
    modulePaths,
    jsTopLevels: [],
  };
}

export function empty(): ProvidedSymbolsConfig {
  return {
    implicitStatements: "",
    modulePaths: new Map(),
    jsTopLevels: [],
  };
}
