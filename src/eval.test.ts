import { describe } from "vitest";
import { testEvalBlockOf } from "./util/test-expectations";

import { ReplOptions } from "./repl";
import { standardModuleRoot } from "./definitions";
import { ModulePaths } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
  function setUpReplOptions(): ReplOptions {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    return {
      transpileOptions: { srcPath: __filename },
      providedSymbols: {
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
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const a { p: 1 }) (const b (structuredClone a)) (equals a.p b.p)",
      expected: true,
      setUpReplOptions,
    });
  });
});
