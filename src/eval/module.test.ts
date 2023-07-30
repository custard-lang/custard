import { describe } from "vitest";

import { ReplOptions } from "../repl";
import { ModulePaths } from "../types";
import { standardModuleRoot } from "../definitions";
import { testEvalBlockOf } from "../test";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
  function setUpReplOptions(): ReplOptions {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "../../test-assets/a.mjs");
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    return {
      transpileOptions: { srcPath: __filename },
      providedSymbols: {
        modulePaths,
        implicitStatements: "(import base)",
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
