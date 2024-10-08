import { describe } from "vitest";

import { testForm } from "../helpers.js";
import type { Config } from "../helpers.js";

import { type ModulePaths } from "@custard-lang/processor/dist/types.js";
import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "..//../assets/a.mjs");
    modulePaths.set("base", `${standardModuleRoot}//base.js`);
    const srcPath = fileOfImportMetaUrl(import.meta.url);
    return {
      optionsForRepl: { srcPath },
      providedSymbols: {
        from: srcPath,
        modulePaths,
        implicitStatements: "(importAnyOf base)",
        jsTopLevels: [],
      },
    };
  }

  testForm({
    src: "(import a) a.a",
    expected: "Module A",
    setUpConfig,
  });

  testForm({
    src: "(export (const b 1) (const c (plusF b 1))) c",
    expected: 2,
    setUpConfig,
  });
});
