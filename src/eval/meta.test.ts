import { describe } from "vitest";
import { testEvalFormOf } from "../util/test-expectations";

import { ReplOptions } from "../repl";
import { ModulePaths } from "../types";
import { standardModuleRoot } from "../definitions";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalForm", () => {
  async function setUpReplOptions(): Promise<ReplOptions> {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("meta", "../../dist/src/lib/meta.js");

    return {
      transpileOptions: { srcPath: __filename },
      providedSymbols: {
        modulePaths,
        builtinModulePaths: [`${standardModuleRoot}/base.js`],
        jsTopLevels: [],
      },
    };
  }
  const preludeSrc = "(import meta)";

  describe("meta.readString", () => {
    testEvalFormOf({
      src: '(meta.readString "(plusF 4.1 5.2)")',
      expected: [[{ t: "Symbol", v: "plusF" }, 4.1, 5.2]],
      setUpReplOptions,
      preludeSrc,
    });

    testEvalFormOf({
      src: '(meta.readString "(const x 9.2) (plusF 4.1 5.2) (let y 0.1)")',
      expected: [
        [{ t: "Symbol", v: "const" }, { t: "Symbol", v: "x" }, 9.2],
        [{ t: "Symbol", v: "plusF" }, 4.1, 5.2],
        [{ t: "Symbol", v: "let" }, { t: "Symbol", v: "y" }, 0.1],
      ],
      setUpReplOptions,
      preludeSrc,
    });
  });

  describe("meta.evaluate", () => {
    testEvalFormOf({
      src: '(meta.evaluate (meta.readString "(plusF 4.1 5.2)"))',
      expected: 4.1 + 5.2,
      setUpReplOptions,
      preludeSrc,
    });

    testEvalFormOf({
      src: '(meta.evaluate (meta.readString "(const x 9.2) (plusF x 5.1) (let y 0.1)"))',
      expected: 9.2 + 5.1,
      setUpReplOptions,
      preludeSrc,
    });
  });
});
