import { describe } from "vitest";

import { testEvalBlockOf, testEvalFormOf } from "../helpers.js";
import type { Config } from "../helpers.js";

import {
  type ModulePaths,
  TranspileError,
} from "@custard-lang/processor/dist/types.js";
import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalForm", () => {
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    modulePaths.set("async", "npm:@custard-lang/processor/dist/lib/async.js");

    const srcPath = fileOfImportMetaUrl(import.meta.url);

    return {
      optionsForRepl: { srcPath },
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

  describe("async.generatorFn", () => {
    testEvalBlockOf({
      src: "(const f (async.generatorFn (xs) (async.forEach x xs (yield x)))) (let r 0) (async.forEach x (f [1]) (assign r (plusF r x))) r",
      expected: 1,
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
        "`async.await` in a non-async function or scope is not allowed.",
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
    testEvalBlockOf({
      src: "(scope (async.forEach x ((async.generatorFn () (yield (async.await (Promise.resolve 0)))))))",
      expected: new TranspileError(
        "`async.forEach` in a non-async function or scope is not allowed.",
      ),
      setUpConfig,
    });
  });
});
