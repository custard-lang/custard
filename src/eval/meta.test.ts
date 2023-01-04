import { assertNonError } from "../util/error";

import * as Env from "../env";
import { readStr } from "../reader";
import { evalForm } from "../eval";

import { describe, expect, test } from "vitest";
import { base } from "../lib/base";
import { merge } from "../scope";

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
      expect(
        await evalForm(
          assertNonError(readStr(src)),
          await Env.init(merge(base)),
        ),
      ).toEqual(expected);
    });
  }

  describe("readString", () => {
    testOf({
      src: '(readString "(plusF 4.1 5.2)")',
      expected: [[{ t: "Symbol", v: "plusF" }, 4.1, 5.2]],
    });

    testOf({
      src: '(readString "(const x 9.2) (plusF x 5.2) (let y 0.1)")',
      expected: [
        [{ t: "Symbol", v: "const" }, { t: "Symbol", v: "x" }, 9.2],
        [{ t: "Symbol", v: "plusF" }, 4.1, 5.2],
        [{ t: "Symbol", v: "let" }, { t: "Symbol", v: "y" }, 0.1],
      ],
    });
  });

  describe("evaluate", () => {
    testOf({
      src: '(evaluate (readString "(plusF 4.1 5.2)"))',
      expected: 4.1 + 5.2,
    });

    testOf({
      src: '(evaluate (readString "(const x 9.2) (plusF x 5.2) (let y 0.1)"))',
      expected: undefined,
    });
  });
});
