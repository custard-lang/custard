import { describe } from "vitest";

import { testForm } from "../helpers.js";
import type { Config } from "../helpers.js";

import {
  type ModulePaths,
  TranspileError,
  assumeIsFile,
} from "@custard-lang/processor/dist/types.js";
import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";

function setUpConfig(): Config {
  const modulePaths: ModulePaths = new Map();
  modulePaths.set("base", `${standardModuleRoot}/base.js`);
  modulePaths.set("async", "npm:@custard-lang/processor/dist/lib/async.js");

  const srcPath = fileOfImportMetaUrl(import.meta.url);

  return {
    optionsForRepl: { src: assumeIsFile(srcPath) },
    providedSymbols: {
      modulePaths,
      implicitStatements: "(importAnyOf base)(import async)",
      jsTopLevels: ["Promise"],
    },
    providedSymbolsPath: srcPath,
  };
}

describe("async.scope", () => {
  testForm({
    src: "(async.scope (plusF 4.1 5.2))",
    expected: 9.3,
    setUpConfig,
  });
  testForm({
    src: "(async.scope (async.await (Promise.resolve 5)))",
    expected: 5,
    setUpConfig,
  });
  testForm({
    src: "(async.scope (forEach _unused [] (async.await (Promise.resolve 0))) (async.await (Promise.resolve 10)))",
    expected: 10,
    setUpConfig,
  });
});

describe("async.fn", () => {
  testForm({
    src: "((async.fn (x) (plusF x 5.2)) 4.1)",
    expected: 9.3,
    setUpConfig,
  });
  testForm({
    src: "((async.fn () (while false (async.await (Promise.resolve 0))) (async.await (Promise.resolve 10))))",
    expected: 10,
    setUpConfig,
  });
});

describe("async.procedure", () => {
  testForm({
    src: "((async.procedure (x) (plusF x 5.2)) 4.1)",
    expected: undefined,
    setUpConfig,
  });
  testForm({
    src: "((async.procedure () (for (let i 0) false true (async.await (Promise.resolve 0))) (return (async.await (Promise.resolve 10)))))",
    expected: 10,
    setUpConfig,
  });
});

describe("async.generatorFn", () => {
  testForm({
    src: "(const f (async.generatorFn (xs) (async.forEach x xs (yield x)))) (let r 0) (async.forEach x (f [1]) (assign r (plusF r x))) r",
    expected: 1,
    setUpConfig,
  });
});

describe("async.await", () => {
  testForm({
    src: "(async.await (Promise.resolve 5))",
    expected: 5,
    setUpConfig,
  });
  testForm({
    src: "(scope (async.await (Promise.resolve 5)))",
    expected: new TranspileError(
      "`async.await` in a non-async function or scope is not allowed.",
    ),
    setUpConfig,
  });
});

describe("async.forEach", () => {
  testForm({
    src: "(let r 1) (async.forEach x ((async.generatorFn () (yield (async.await (Promise.resolve 0))))) (assign r (timesF r x))) r",
    expected: 0,
    setUpConfig,
  });
  testForm({
    src: "(scope (async.forEach x ((async.generatorFn () (yield (async.await (Promise.resolve 0)))))))",
    expected: new TranspileError(
      "`async.forEach` in a non-async function or scope is not allowed.",
    ),
    setUpConfig,
  });
});
