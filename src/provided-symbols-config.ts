import * as path from "node:path";
import * as fs from "node:fs";

import { isAbsoluteUrl } from "./util/path.js";

import { FilePath, Id, ProvidedSymbolsConfig } from "./types.js";
import {
  CompleteProvidedSymbolsConfig,
  ModulePaths,
} from "./internal/types.js";

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

export function resolveModulePaths({
  from,
  modulePaths,
}: CompleteProvidedSymbolsConfig): ModulePaths {
  const fromDir = fs.statSync(from).isDirectory() ? from : path.dirname(from);
  const result: ModulePaths = new Map();
  for (const [moduleName, modulePath] of modulePaths) {
    const moduleFullPath = isAbsoluteUrl(modulePath)
      ? modulePath
      : path.resolve(fromDir, modulePath);
    result.set(moduleName, moduleFullPath);
  }
  return result;
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
