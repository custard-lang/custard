import { describe } from "vitest";

import { ReplOptions } from "../repl";
import { ModulePaths } from "../types";
import { standardModuleRoot } from "../definitions";
import { testEvalBlockOf } from "../util/test-expectations";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
  async function setUpReplOptions(): Promise<ReplOptions> {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "../../test-assets/a.mjs");
    return {
      transpileOptions: { srcPath: __filename },
      providedSymbols: {
        modulePaths,
        builtinModulePaths: [`${standardModuleRoot}/base.js`],
        jsTopLevels: [],
      },
    };
  }

  testEvalBlockOf({
    src: "(import a) a.a",
    expected: "Module A",
    setUpReplOptions,
  });
});
