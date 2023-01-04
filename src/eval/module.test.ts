import { describe, test, expect } from "vitest";

import * as Env from "../env";
import { ModulePaths, transpileOptionsRepl } from "../types";
import { base } from "../lib/base";
import { evalBlock } from "../eval";
import { assertNonError } from "../util/error";
import { readBlock } from "../reader";

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
      const modules: ModulePaths = new Map();
      modules.set("a", "../../test-assets/a.js");

      expect(
        await evalBlock(
          assertNonError(readBlock(src)),
          await Env.init(
            base(),
            modules,
            await transpileOptionsRepl(__filename),
          ),
        ),
      ).toEqual(expected);
    });
  }

  testOf({
    src: "(import a) a.a",
    expected: "Module A",
  });
});
