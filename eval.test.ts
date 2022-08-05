import { assertNonError } from "./util/error";

import * as Env from "./env.js";
import { readBlock, readStr } from "./reader";
import { evalForm, builtin, evalBlock } from "./eval";
import { describe, expect, test } from "vitest";
import { TranspileError } from "./types";

describe("evalForm", () => {
  test("`( plusF 2.0 (timesF 3.0 4.0) )`", () => {
    expect(
      evalForm(
        assertNonError(readStr("( plusF 2.0 (timesF 3.0 4.0) )")),
        Env.init(builtin())
      )
    ).toEqual(14);
  });

  test('`(eval "1")`', () => {
    const src = '(eval "1")';
    expect(evalForm(assertNonError(readStr(src)), Env.init(builtin()))).toEqual(
      new TranspileError('No function "eval" is defined!')
    );
  });

  test("`(plusF eval eval)`", () => {
    const src = "(plusF eval eval)";
    expect(evalForm(assertNonError(readStr(src)), Env.init(builtin()))).toEqual(
      new TranspileError('No variable "eval" is defined!')
    );
  });
});

describe("evalBlock", () => {
  test("`(const x (timesF 3 3))(plusF x 2)`", () => {
    const src = "(const x (timesF 3 3))(plusF x 2)";
    expect(
      assertNonError(
        evalBlock(assertNonError(readBlock(src)), Env.init(builtin()))
      )
    ).toEqual(11);
  });

  test("`(let y (dividedByF 3 2))(assign y (plusF y 2))(minusF y 7)`", () => {
    const src = "(let y (dividedByF 3 2))(assign y (plusF y 2))(minusF y 6)";
    expect(
      assertNonError(
        evalBlock(assertNonError(readBlock(src)), Env.init(builtin()))
      )
    ).toEqual(-2.5);
  });

  test("`(const y 5)(const y 3)`", () => {
    const src = "(const y 5)(const y 3)";
    expect(
      evalBlock(assertNonError(readBlock(src)), Env.init(builtin()))
    ).toEqual(new TranspileError('Variable "y" is already defined!'));
  });

  test("`(let y 6)(let y 7)`", () => {
    const src = "(let y 6)(let y 7)";
    expect(
      evalBlock(assertNonError(readBlock(src)), Env.init(builtin()))
    ).toEqual(new TranspileError('Variable "y" is already defined!'));
  });
});
