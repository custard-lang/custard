import { describe, expect, test } from "vitest";

import { assertNonError } from "./util/error";

import { Repl } from "./repl";
import { readBlock } from "./reader";
import { evalBlock } from "./eval";
import { standardRoot } from "./module";

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
      const opts = {
        transpileOptions: { srcPath: __filename },
        providedSymbols: {
          modulePaths: new Map(),
          builtinModulePaths: [`${standardRoot}/base.js`],
          jsTopLevels: ["structuredClone"],
        },
      };
      await Repl.using(opts, async (repl) => {
        expect(await evalBlock(assertNonError(readBlock(src)), repl)).toEqual(
          expected,
        );
      });
    });
  }

  describe("structuredClone, provided by `jsTopLevels`", () => {
    testOf({
      src: "(const a { p: 1 }) (notEquals a (structuredClone a))",
      expected: true,
    });

    testOf({
      src: "(const a { p: 1 }) (const b (structuredClone a)) (equals a.p b.p)",
      expected: true,
    });
  });
});
