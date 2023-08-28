import * as path from "node:path";

import { FilePath, Id, ProvidedSymbolsConfig } from "./types.js";

export function build({
  builtinModulePaths,
  otherModulePaths,
  implicitStatements,
  jsTopLevels,
}: {
  builtinModulePaths: FilePath[];
  otherModulePaths: Map<Id, FilePath>;
  implicitStatements: string;
  jsTopLevels: Id[];
}): ProvidedSymbolsConfig {
  let importAnys = "";
  const modulePaths: Map<string, string> = new Map(otherModulePaths);

  for (const modulePath of builtinModulePaths) {
    const moduleName = path.basename(modulePath, path.extname(modulePath));
    importAnys = `${importAnys}(importAnyOf ${moduleName})`;
    modulePaths.set(moduleName, modulePath);
  }

  return {
    implicitStatements: `${importAnys}${implicitStatements}`,
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
    implicitStatements: "",
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
