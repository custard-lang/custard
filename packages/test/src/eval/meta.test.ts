import * as path from "node:path";
import { describe, expect, test } from "vitest";

import { Config, testEvalBlockOf, testEvalFormOf } from "../test.js";
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

  describe("meta.quasiQuote", () => {
    const path = "testQuasiQuote";
    const location = (l: number, c: number) => ({ f: path, l, c });

    testEvalFormOf({
      src: '(meta.quasiQuote (const x 9.2)\n(let y (minusF 10 (timesF "3"))) [x\n(dividedByF) [] { x: y y }] )',
      expected: {
        t: "List",
        v: [
          {
            t: "List",
            v: [
              { t: "Symbol", v: "const", ...location(1, 18), },
              { t: "Symbol", v: "x", ...location(1, 24), },
              { t: "Number", v: 9.2, ...location(1, 26), },
            ],
            ...location(1, 18),
          },
          {
            t: "List",
            v: [
              { t: "Symbol", v: "let", ...location(2, 2), },
              { t: "Symbol", v: "y", ...location(2, 5), },
              {
                t: "List",
                v: [
                  { t: "Symbol", v: "minusF", ...location(2, 9), },
                  { t: "Number", v: 10, ...location(2, 16), },
                  {
                    t: "List",
                    v: [
                      { t: "Symbol", v: "timesF", ...location(2, 20), },
                      { t: "String", v: "3", ...location(2, 27), },
                    ],
                    ...location(2, 19),
                  },
                ],
                ...location(2, 7),
              },
            ],
            ...location(2, 1),
          },
          {
            t: "Array",
            v: [
              { t: "Symbol", v: "x", ...location(2, 36), },
              {
                t: "List",
                v: [
                  { t: "Symbol", v: "dividedByF", ...location(3, 2), },
                ],
                ...location(3, 1),
              },
              { t: "Array", v: [], ...location(3, 14), },
              {
                t: "Object",
                v: [
                  [
                    { t: "Symbol", v: "x", ...location(3, 19), },
                    { t: "Symbol", v: "y", ...location(3, 22), },
                  ],
                  { t: "Symbol", v: "y", ...location(3, 24), },
                ],
                ...location(3, 17),
              },
            ],
            ...location(2, 34),
          },
        ]
      },
      setUpConfig,
    });

    const declareVarName = '(let v1 (meta.symbol "varName")) ';
    const declareVarNameLength = declareVarName.length;
    testEvalBlockOf({
      src: `${declareVarName}(meta.quasiQuote ((const x $v1)\n(let y (minusF 10 (timesF $v1))) [x\n(dividedByF) [] { x: y $v1 }] ))`,
      expected: {
        t: "List",
        v: [
          {
            t: "List",
            v: [
              { t: "Symbol", v: "const", ...location(1, 18 + declareVarNameLength), },
              { t: "Symbol", v: "x", ...location(1, 24 + declareVarNameLength), },
              { t: "Symbol", v: "varName", ...location(1, 26 + declareVarNameLength), },
            ],
            ...location(1, 18 + declareVarNameLength),
          },
          {
            t: "List",
            v: [
              { t: "Symbol", v: "let", ...location(2, 2), },
              { t: "Symbol", v: "y", ...location(2, 5), },
              {
                t: "List",
                v: [
                  { t: "Symbol", v: "minusF", ...location(2, 9), },
                  { t: "Number", v: 10, ...location(2, 16), },
                  {
                    t: "List",
                    v: [
                      { t: "Symbol", v: "timesF", ...location(2, 20), },
                      { t: "Symbol", v: "varName", ...location(2, 27), },
                    ],
                    ...location(2, 19),
                  },
                ],
                ...location(2, 7),
              },
            ],
            ...location(2, 1),
          },
          {
            t: "Array",
            v: [
              { t: "Symbol", v: "x", ...location(2, 36), },
              {
                t: "List",
                v: [
                  { t: "Symbol", v: "dividedByF", ...location(3, 2), },
                ],
                ...location(3, 1),
              },
              { t: "Array", v: [], ...location(3, 14), },
              {
                t: "Object",
                v: [
                  [
                    { t: "Symbol", v: "x", ...location(3, 19), },
                    { t: "Symbol", v: "y", ...location(3, 22), },
                  ],
                  { t: "Symbol", v: "varName", ...location(3, 24), },
                ],
                ...location(3, 17),
              },
            ],
            ...location(2, 34),
          },
        ]
      },
      setUpConfig,
    });

    testEvalBlockOf({
      src: '(const vars [(meta.symbol "varName") "varName2" 9 {}]) (meta.quasiQuote (const xs [12 ...$vars]))',
      expected: {
        t: "List",
        v: [
          { t: "Symbol", v: "const", ...location(1, 74), },
          { t: "Symbol", v: "xs", ...location(1, 80), },
          {
            t: "Array",
            v: [
              { t: "Symbol", v: "varName", ...location(1, 87), },
              { t: "String", v: "varName2", ...location(1, 87), },
              { t: "Number", v: 9, ...location(1, 87), },
              { t: "Object", v: [], ...location(1, 87), },
            ],
            ...location(1, 83),
          },
        ],
        ...location(1, 73),
      },
      setUpConfig,
    });

  });
});
