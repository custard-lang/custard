import { describe, expect, test } from "vitest";

import { Config, testEvalFormOf } from "../test";

import { assertNonError } from "../util/error";

import { Form, ModulePaths } from "../types";
import { standardModuleRoot } from "../definitions";
import { evalForm } from "../eval";
import { readStr } from "../reader";
import { withNewPath } from "../test/tmp-file";
import { writeAndEval } from "../test/eval";
import { initializeForRepl } from "../env";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */

describe("evalForm", () => {
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    modulePaths.set("meta", "../../dist/src/lib/meta.js");
    modulePaths.set("async", "../../dist/src/lib/async.js");

    return {
      options: { srcPath: __filename },
      providedSymbols: {
        modulePaths,
        implicitStatements: "(importAnyOf base)(import meta)(import async)",
        jsTopLevels: [],
      },
    };
  }

  describe("meta.readString", () => {
    testEvalFormOf({
      src: '(meta.readString "(plusF 4.1 5.2)")',
      expected: [[{ t: "Symbol", v: "plusF" }, 4.1, 5.2]],
      setUpConfig,
    });

    testEvalFormOf({
      src: '(meta.readString "(const x 9.2) (plusF 4.1 5.2) (let y 0.1)")',
      expected: [
        [{ t: "Symbol", v: "const" }, { t: "Symbol", v: "x" }, 9.2],
        [{ t: "Symbol", v: "plusF" }, 4.1, 5.2],
        [{ t: "Symbol", v: "let" }, { t: "Symbol", v: "y" }, 0.1],
      ],
      setUpConfig,
    });
  });

  describe("meta.transpileModule", () => {
    const basePathJson = JSON.stringify(`${standardModuleRoot}/base.js`);
    const proviedSymbolsSrc = `{ modulePaths: (Map [["base" ${basePathJson}]]), implicitStatements: "(importAnyOf base)", jsTopLevels: [] }`;
    const extraOptionsSrc = `{ mayHaveResult: true }`;

    test("transpiled source code can be `eval`ed as a JavaScript code 1.", async () => {
      const { options, providedSymbols } = setUpConfig();
      const env = assertNonError(
        await initializeForRepl(options, providedSymbols),
      );

      await withNewPath(async ({ src, dest }) => {
        const transpileOptionsSrc = `{ srcPath: ${JSON.stringify(src)} }`;
        const srcCode = `(async.await (meta.transpileModule (meta.readString "(plusF 4.1 5.2)") ${transpileOptionsSrc} ${proviedSymbolsSrc} ${extraOptionsSrc}))`;
        const result = assertNonError(
          await evalForm(assertNonError(readStr(srcCode)) as Form, env),
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
        const srcCode = `(async.await (meta.transpileModule (meta.readString "(const x 9.2) (let y 0.1) (plusF x y)") ${transpileOptionsSrc} ${proviedSymbolsSrc} ${extraOptionsSrc}))`;
        const result = assertNonError(
          await evalForm(assertNonError(readStr(srcCode)) as Form, env),
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
