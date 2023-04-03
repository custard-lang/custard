import { describe } from "vitest";
import { testEvalFormOf } from "../util/test-expectations";

import { ReplOptions } from "../repl";
import { ModulePaths, TranspileError } from "../types";
import { standardModuleRoot } from "../definitions";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalForm", () => {
  function setUpReplOptions(): ReplOptions {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("async", "../../dist/src/lib/async.js");

    return {
      transpileOptions: { srcPath: __filename },
      providedSymbols: {
        modulePaths,
        builtinModulePaths: [`${standardModuleRoot}/base.js`],
        jsTopLevels: ["Promise"],
      },
    };
  }
  const preludeSrc = "(import async)";

  describe("async.scope", () => {
    testEvalFormOf({
      src: "(async.scope (plusF 4.1 5.2))",
      expected: 9.3,
      setUpReplOptions,
      preludeSrc,
    });
    testEvalFormOf({
      src: "(async.scope (async.await (Promise.resolve 5)))",
      expected: 5,
      setUpReplOptions,
      preludeSrc,
    });
    testEvalFormOf({
      src: "(async.scope (forEach _unused (array) (async.await (Promise.resolve 0))) (async.await (Promise.resolve 10)))",
      expected: 10,
      setUpReplOptions,
      preludeSrc,
    });
  });

  describe("async.fn", () => {
    testEvalFormOf({
      src: "((async.fn (x) (plusF x 5.2)) 4.1)",
      expected: 9.3,
      setUpReplOptions,
      preludeSrc,
    });
    testEvalFormOf({
      src: "((async.fn () (while false (async.await (Promise.resolve 0))) (async.await (Promise.resolve 10))))",
      expected: 10,
      setUpReplOptions,
      preludeSrc,
    });
  });

  describe("async.procedure", () => {
    testEvalFormOf({
      src: "((async.procedure (x) (plusF x 5.2)) 4.1)",
      expected: undefined,
      setUpReplOptions,
      preludeSrc,
    });
    testEvalFormOf({
      src: "((async.procedure () (for (let i 0) false true (async.await (Promise.resolve 0))) (return (async.await (Promise.resolve 10)))))",
      expected: 10,
      setUpReplOptions,
      preludeSrc,
    });
  });

  describe("async.await", () => {
    testEvalFormOf({
      src: "(async.await (Promise.resolve 5))",
      expected: new TranspileError(
        "Top-level `await` is not supported yet. Sorry.",
      ),
      setUpReplOptions,
      preludeSrc,
    });
    testEvalFormOf({
      src: "(scope (async.await (Promise.resolve 5)))",
      expected: new TranspileError(
        "`await` in a non-async function or scope is not allowed.",
      ),
      setUpReplOptions,
      preludeSrc,
    });
  });
});
