import { describe } from "vitest";

import { type Config, testForm } from "./helpers.js";

import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import { type ModulePaths } from "@custard-lang/processor/dist/types.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";

function setUpConfig(): Config {
  const modulePaths: ModulePaths = new Map();
  modulePaths.set("base", `${standardModuleRoot}/base.js`);

  const srcPath = fileOfImportMetaUrl(import.meta.url);

  return {
    optionsForRepl: { srcPath },
    providedSymbols: {
      from: srcPath,
      modulePaths,
      implicitStatements: "(importAnyOf base)",
      jsTopLevels: ["structuredClone"],
    },
  };
}

describe("structuredClone, provided by `jsTopLevels`", () => {
  testForm({
    src: "(const a { p: 1 }) (notEquals a (structuredClone a))",
    expected: true,
    setUpConfig,
  });

  testForm({
    src: "(const a { p: 1 }) (const b (structuredClone a)) (equals a.p b.p)",
    expected: true,
    setUpConfig,
  });
});
