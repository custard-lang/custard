import { type Config, testForm } from "../helpers.js";

import { defaultTranspileOptions } from "@custard-lang/processor/dist/types.js";
import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import * as ProvidedSymbolsConfig from "@custard-lang/processor/dist/provided-symbols-config.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";

function setUpConfig(): Config {
  const providedSymbols = ProvidedSymbolsConfig.build({
    builtinModulePaths: [
      `${standardModuleRoot}/base.js`,
      `${standardModuleRoot}/js.js`,
    ],
    otherModulePaths: new Map(),
    implicitStatements: "",
    jsTopLevels: ["Date", "Object"],
  });
  return {
    optionsForRepl: defaultTranspileOptions(),
    providedSymbols: {
      from: fileOfImportMetaUrl(import.meta.url),
      ...providedSymbols,
    },
  };
}

testForm({
  src: "(instanceof (new Date) Date)",
  expected: true,
  setUpConfig,
});
testForm({
  src: "(instanceof (new Object) Date)",
  expected: false,
  setUpConfig,
});

testForm({
  src: "(const bd (new Date 2022 3 16)) (bd.getYear)",
  expected: 122,
  setUpConfig,
});
