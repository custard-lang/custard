import { describe, test, expect } from "vitest";

import { Repl } from "../repl";
import { ModulePaths } from "../types";
import { evalBlock } from "../eval";
import { assertNonError } from "../util/error";
import { readBlock } from "../reader";
import { standardRoot } from "../module";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */

describe("evalBlock", () => {
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
      modulePaths.set("a", "../../test-assets/a.mjs");
      const opts = {
        transpileOptions: { srcPath: __filename },
        providedSymbols: {
          modulePaths,
          builtinModulePaths: [`${standardRoot}/base.js`],
        },
      };
      await Repl.using(opts, async (repl) => {
        expect(await evalBlock(assertNonError(readBlock(src)), repl)).toEqual(
          expected,
        );
      });
    });
  }

  testOf({
    src: "(import a) a.a",
    expected: "Module A",
  });
});
