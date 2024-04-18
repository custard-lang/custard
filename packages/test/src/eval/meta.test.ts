import * as path from "node:path";
import { describe, expect, test } from "vitest";

import { Config, testEvalFormOf } from "../test.js";
import { withNewPath } from "../test/tmp-file.js";
import { writeAndEval } from "../test/eval.js";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";

import {
  FilePath,
  Form,
  JsSrc,
  ModulePaths,
} from "@custard-lang/processor/dist/types.js";
import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import { evalForm } from "@custard-lang/processor/dist/eval.js";
import { readBlock, readStr } from "@custard-lang/processor/dist/reader.js";
import { initializeForRepl } from "@custard-lang/processor/dist/env.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */

describe("evalForm", () => {
  const srcPath = fileOfImportMetaUrl(import.meta.url);
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    modulePaths.set("meta", `${standardModuleRoot}/meta.js`);
    modulePaths.set("async", `${standardModuleRoot}/async.js`);
    modulePaths.set("js", `${standardModuleRoot}/js.js`);

    return {
      options: { srcPath },
      providedSymbols: {
        from: srcPath,
        modulePaths,
        implicitStatements:
          "(importAnyOf base)(import meta)(import async)(import js)",
        jsTopLevels: ["Map"],
      },
    };
  }

  describe("meta.readString", () => {
    const srcPathForErrorMessage = `${path.normalize(srcPath)}//(REPL)`;

    const contents1 = "(plusF 4.1 5.2)";
    testEvalFormOf({
      src: `(meta.readString "${contents1}")`,
      expected: readBlock({
        contents: contents1,
        path: srcPathForErrorMessage,
      }),
      setUpConfig,
    });

    const contents2 = "(const x 9.2) (plusF 4.1 5.2) (let y 0.1)";
    testEvalFormOf({
      src: `(meta.readString "${contents2}")`,
      expected: readBlock({
        contents: contents2,
        path: srcPathForErrorMessage,
      }),
      setUpConfig,
    });
  });

  describe("meta.transpileModule", () => {
    const basePathJson = JSON.stringify(`${standardModuleRoot}/base.js`);
    const proviedSymbolsSrcFrom = (src: FilePath): JsSrc => {
      const fromSrc = JSON.stringify(src);
      return `{ modulePaths: (js.new Map [["base" ${basePathJson}]]) implicitStatements: "(importAnyOf base)" jsTopLevels: [] from: ${fromSrc} }`;
    };
    const extraOptionsSrc = `{ mayHaveResult: true }`;

    test("transpiled source code can be `eval`ed as a JavaScript code 1.", async () => {
      const { options, providedSymbols } = setUpConfig();
      const env = assertNonError(
        await initializeForRepl(options, providedSymbols),
      );

      await withNewPath(async ({ src, dest }) => {
        const transpileOptionsSrc = `{ srcPath: ${JSON.stringify(src)} }`;
        const proviedSymbolsSrc = proviedSymbolsSrcFrom(src);
        const input = {
          contents: `(async.await (meta.transpileModule (meta.readString "(plusF 4.1 5.2)") ${transpileOptionsSrc} ${proviedSymbolsSrc} ${extraOptionsSrc}))`,
          path: "test",
        };
        const result = assertNonError(
          await evalForm(assertNonError(readStr(input)) as Form, env),
        );
        expect(await writeAndEval(dest, result)).toEqual(4.1 + 5.2);
      });
    });

    test("transpiled source code can be `eval`ed as a JavaScript code 2.", async () => {
      const { options, providedSymbols } = setUpConfig();
      const env = assertNonError(
        await initializeForRepl(options, providedSymbols),
      );

      await withNewPath(async ({ src, dest }) => {
        const transpileOptionsSrc = `{ srcPath: ${JSON.stringify(src)} }`;
        const proviedSymbolsSrc = proviedSymbolsSrcFrom(src);
        const input = {
          contents: `(async.await (meta.transpileModule (meta.readString "(const x 9.2) (let y 0.1) (plusF x y)") ${transpileOptionsSrc} ${proviedSymbolsSrc} ${extraOptionsSrc}))`,
          path: "test",
        };
        const result = assertNonError(
          await evalForm(assertNonError(readStr(input)) as Form, env),
        );
        expect(await writeAndEval(dest, result)).toEqual(9.2 + 0.1);
      });
    });
  });

  describe("meta.evaluate", () => {
    testEvalFormOf({
      src: '(meta.evaluate (meta.readString "(plusF 4.1 5.2)"))',
      expected: 4.1 + 5.2,
      setUpConfig,
    });

    testEvalFormOf({
      src: '(meta.evaluate (meta.readString "(const x 9.2) (let y 0.1) (plusF x y)"))',
      expected: 9.2 + 0.1,
      setUpConfig,
    });
  });
});
