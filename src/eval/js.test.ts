import { describe } from "vitest";
import { Config, testEvalBlockOf, testEvalFormOf } from "../test";

import { defaultTranspileOptions } from "../types";
import { standardModuleRoot } from "../definitions";
import * as ProvidedSymbolsConfig from "../provided-symbols-config";
import { fileOfImportMetaUrl } from "../util/path";

async function setUpConfig(): Promise<Config> {
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
    options: await defaultTranspileOptions(),
    providedSymbols: {
      from: fileOfImportMetaUrl(import.meta.url),
      ...providedSymbols,
    },
  };
}

describe("evalForm", () => {
  testEvalFormOf({
    src: "(instanceof (new Date) Date)",
    expected: true,
    setUpConfig,
  });
  testEvalFormOf({
    src: "(instanceof (new Object) Date)",
    expected: false,
    setUpConfig,
  });
});

describe("evalBlock", () => {
  testEvalBlockOf({
    src: "(const bd (new Date 2022 3 16)) (bd.getYear)",
    expected: 122,
    setUpConfig,
  });
});
