import { describe, expect, test } from "vitest";

import { assertNonError } from "../util/error";

import { Repl } from "../repl";
import { readStr } from "../reader";
import { evalForm } from "../eval";
import { ModulePaths } from "../types";
import { standardRoot } from "../module";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalForm", () => {
  function testOf({
    src,
    expected,
    only,
  }: {
    src: string;
    expected: any;
    only?: undefined | true;
  }): void {
    const t = only ? test.only : test;
    t(`\`${src}\` => ${expected}`, async () => {
      const modulePaths: ModulePaths = new Map();
      modulePaths.set("meta", "../../dist/src/lib/meta.js");

      const opts = {
        transpileOptions: { srcPath: __filename },
        providedSymbols: {
          modulePaths,
          builtinModulePaths: [`${standardRoot}/base.js`],
        },
      };
      await Repl.using(opts, async (repl) => {
        void (await evalForm(assertNonError(readStr("(import meta)")), repl));
        expect(await evalForm(assertNonError(readStr(src)), repl)).toEqual(
          expected,
        );
      });
    });
  }

  describe("readString", () => {
    testOf({
      src: '(meta.readString "(plusF 4.1 5.2)")',
      expected: [[{ t: "Symbol", v: "plusF" }, 4.1, 5.2]],
    });

    testOf({
      src: '(meta.readString "(const x 9.2) (plusF 4.1 5.2) (let y 0.1)")',
      expected: [
        [{ t: "Symbol", v: "const" }, { t: "Symbol", v: "x" }, 9.2],
        [{ t: "Symbol", v: "plusF" }, 4.1, 5.2],
        [{ t: "Symbol", v: "let" }, { t: "Symbol", v: "y" }, 0.1],
      ],
    });
  });

  describe("evaluate", () => {
    testOf({
      src: '(meta.evaluate (meta.readString "(plusF 4.1 5.2)"))',
      expected: 4.1 + 5.2,
    });

    testOf({
      src: '(meta.evaluate (meta.readString "(const x 9.2) (plusF x 5.1) (let y 0.1)"))',
      expected: 9.2 + 5.1,
    });
  });
});
