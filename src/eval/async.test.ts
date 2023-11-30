import { describe } from "vitest";
import { testEvalBlockOf, testEvalFormOf } from "../test";

import { ModulePaths, TranspileError } from "../types";
import { standardModuleRoot } from "../definitions";
import type { Config } from "../test";
import { fileOfImportMetaUrl } from "../util/path";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalForm", () => {
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    modulePaths.set("async", "../../dist/src/lib/async.js");

    const srcPath = fileOfImportMetaUrl(import.meta.url);

    return {
      options: { srcPath },
      providedSymbols: {
        from: srcPath,
        modulePaths,
        implicitStatements: "(importAnyOf base)(import async)",
        jsTopLevels: ["Promise"],
      },
    };
  }

  describe("async.scope", () => {
    testEvalFormOf({
      src: "(async.scope (plusF 4.1 5.2))",
      expected: 9.3,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(async.scope (async.await (Promise.resolve 5)))",
      expected: 5,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(async.scope (forEach _unused [] (async.await (Promise.resolve 0))) (async.await (Promise.resolve 10)))",
      expected: 10,
      setUpConfig,
    });
  });

  describe("async.fn", () => {
    testEvalFormOf({
      src: "((async.fn (x) (plusF x 5.2)) 4.1)",
      expected: 9.3,
      setUpConfig,
    });
    testEvalFormOf({
      src: "((async.fn () (while false (async.await (Promise.resolve 0))) (async.await (Promise.resolve 10))))",
      expected: 10,
      setUpConfig,
    });
  });

  describe("async.procedure", () => {
    testEvalFormOf({
      src: "((async.procedure (x) (plusF x 5.2)) 4.1)",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "((async.procedure () (for (let i 0) false true (async.await (Promise.resolve 0))) (return (async.await (Promise.resolve 10)))))",
      expected: 10,
      setUpConfig,
    });
  });

  describe("async.await", () => {
    testEvalFormOf({
      src: "(async.await (Promise.resolve 5))",
      expected: 5,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (async.await (Promise.resolve 5)))",
      expected: new TranspileError(
        "`await` in a non-async function or scope is not allowed.",
      ),
      setUpConfig,
    });
  });

  describe("async.forEach", () => {
    testEvalBlockOf({
      src: "(let r 1) (async.forEach x ((async.generatorFn () (yield (async.await (Promise.resolve 0))))) (assign r (timesF r x))) r",
      expected: 0,
      setUpConfig,
    });
  });
});
