import { describe } from "vitest";

import { type Config, testEvalBlockOf } from "./test.js";

import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import { type ModulePaths } from "@custard-lang/processor/dist/types.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);

    const srcPath = fileOfImportMetaUrl(import.meta.url);

    return {
      options: { srcPath },
      providedSymbols: {
        from: srcPath,
        modulePaths,
        implicitStatements: "(importAnyOf base)",
        jsTopLevels: ["structuredClone"],
      },
    };
  }

  describe("structuredClone, provided by `jsTopLevels`", () => {
    testEvalBlockOf({
      src: "(const a { p: 1 }) (notEquals a (structuredClone a))",
      expected: true,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const a { p: 1 }) (const b (structuredClone a)) (equals a.p b.p)",
      expected: true,
      setUpConfig,
    });
  });
});
