import { describe } from "vitest";

import { ModulePaths } from "../types";
import { standardModuleRoot } from "../definitions";
import { testEvalBlockOf } from "../test";
import type { Config } from "../test";
import { fileOfImportMetaUrl } from "../util/path";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "../../test-assets/a.mjs");
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    const srcPath = fileOfImportMetaUrl(import.meta.url);
    return {
      options: { srcPath },
      providedSymbols: {
        from: srcPath,
        modulePaths,
        implicitStatements: "(import base)",
        jsTopLevels: [],
      },
    };
  }

  testEvalBlockOf({
    src: "(import a) a.a",
    expected: "Module A",
    setUpConfig,
  });
});
