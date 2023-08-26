import * as path from "node:path";

import { FilePath, Id, ProvidedSymbolsConfig } from "./types.js";

export function build({
  builtinModulePaths,
  otherModulePaths,
  jsTopLevels,
}: {
  builtinModulePaths: FilePath[];
  otherModulePaths: Map<Id, FilePath>;
  jsTopLevels: Id[];
}): ProvidedSymbolsConfig {
  let implicitStatements = "";
  const modulePaths: Map<string, string> = new Map(otherModulePaths);

  for (const modulePath of builtinModulePaths) {
    const moduleName = path.basename(modulePath, path.extname(modulePath));
    implicitStatements = `${implicitStatements}(importAnyOf ${moduleName})`;
    modulePaths.set(moduleName, modulePath);
  }

  return {
    implicitStatements,
    modulePaths,
    jsTopLevels,
  };
}

export function implicitlyImporting(
  ...builtinModulePaths: FilePath[]
): ProvidedSymbolsConfig {
  return build({
    builtinModulePaths,
    otherModulePaths: new Map(),
    jsTopLevels: [],
  });
}

export function empty(): ProvidedSymbolsConfig {
  return {
    implicitStatements: "",
    modulePaths: new Map(),
    jsTopLevels: [],
  };
}
