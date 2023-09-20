import { describe } from "vitest";
import { Config, testEvalBlockOf } from "./test";

import { standardModuleRoot } from "./definitions";
import { ModulePaths, transpileOptionsFromPath } from "./types";
import { fileOfImportMetaUrl } from "./util/path";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
  async function setUpConfig(): Promise<Config> {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);

    const srcPath = fileOfImportMetaUrl(import.meta.url);

    return {
      options: await transpileOptionsFromPath(srcPath),
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
