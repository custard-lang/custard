import { assertNonError } from "./util/error";

import * as Env from "./env.js";
import { readBlock, readStr } from "./reader";
import { evalForm, evalBlock } from "./eval";
import { describe, expect, test } from "vitest";
import { TranspileError } from "./types";
import { base } from "./lib/base";

describe("evalForm", () => {
  test("`( plusF 2.0 (timesF 3.0 4.0) )`", () => {
    expect(
      evalForm(
        assertNonError(readStr("( plusF 2.0 (timesF 3.0 4.0) )")),
        Env.init(base())
      )
    ).toEqual(14);
  });

  test('`(eval "1")`', () => {
    const src = '(eval "1")';
    expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
      new TranspileError('No function "eval" is defined!')
    );
  });

  test("`(plusF eval eval)`", () => {
    const src = "(plusF eval eval)";
    expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
      new TranspileError('No variable "eval" is defined!')
    );
  });

  describe("(equals x y)", () => {
    test('`(scope (const x "123") (equals x "123"))`', () => {
      const src = '(scope (const x "123") (equals x "123"))';
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });

    test('`(scope (const x "123") (equals x 123))`', () => {
      const src = '(scope (const x "123") (equals x 123))';
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });
  });

  describe("(notEquals x y)", () => {
    test("`(scope (const x 123) (notEquals x 123))`", () => {
      const src = "(scope (const x 123) (notEquals x 123))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });

    test('`(scope (const x 123) (notEquals x "123"))`', () => {
      const src = '(scope (const x 123) (notEquals x "123"))';
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });
  });

  describe("(isLessThan x y)", () => {
    test("`(scope (const x 123) (isLessThan x 124))`", () => {
      const src = "(scope (const x 123) (isLessThan x 124))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });

    test("`(scope (const x 123) (isLessThan x 123))`", () => {
      const src = "(scope (const x 123) (isLessThan x 123))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });

    test("`(scope (const x 123) (isLessThan x 122))`", () => {
      const src = "(scope (const x 123) (isLessThan x 122))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });
  });

  describe("(isLessThanOrEquals x y)", () => {
    test("`(scope (const x 123) (isLessThanOrEquals x 124))`", () => {
      const src = "(scope (const x 123) (isLessThanOrEquals x 124))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });

    test("`(scope (const x 123) (isLessThanOrEquals x 123))`", () => {
      const src = "(scope (const x 123) (isLessThanOrEquals x 123))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });

    test("`(scope (const x 123) (isLessThanOrEquals x 122))`", () => {
      const src = "(scope (const x 123) (isLessThanOrEquals x 122))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });
  });

  describe("(isGreaterThan x y)", () => {
    test("`(scope (const x 123) (isGreaterThan x 124))`", () => {
      const src = "(scope (const x 123) (isGreaterThan x 124))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });

    test("`(scope (const x 123) (isGreaterThan x 123))`", () => {
      const src = "(scope (const x 123) (isGreaterThan x 123))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });

    test("`(scope (const x 123) (isGreaterThan x 122))`", () => {
      const src = "(scope (const x 123) (isGreaterThan x 122))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });
  });

  describe("(isGreaterThanOrEquals x y)", () => {
    test("`(scope (const x 123) (isGreaterThanOrEquals x 124))`", () => {
      const src = "(scope (const x 123) (isGreaterThanOrEquals x 124))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        false
      );
    });

    test("`(scope (const x 123) (isGreaterThanOrEquals x 123))`", () => {
      const src = "(scope (const x 123) (isGreaterThanOrEquals x 123))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });

    test("`(scope (const x 123) (isGreaterThanOrEquals x 122))`", () => {
      const src = "(scope (const x 123) (isGreaterThanOrEquals x 122))";
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        true
      );
    });
  });
});

describe("evalBlock", () => {
  test("`(const x (timesF 3 3))(plusF x 2)`", () => {
    const src = "(const x (timesF 3 3))(plusF x 2)";
    expect(
      assertNonError(
        evalBlock(assertNonError(readBlock(src)), Env.init(base()))
      )
    ).toEqual(11);
  });

  test("`(let y (dividedByF 3 2))(assign y (plusF y 2))(minusF y 7)`", () => {
    const src = "(let y (dividedByF 3 2))(assign y (plusF y 2))(minusF y 6)";
    expect(
      assertNonError(
        evalBlock(assertNonError(readBlock(src)), Env.init(base()))
      )
    ).toEqual(-2.5);
  });

  test("`(const y 5)(const y 3)`", () => {
    const src = "(const y 5)(const y 3)";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      new TranspileError('Variable "y" is already defined!')
    );
  });

  test("`(let y 6)(let y 7)`", () => {
    const src = "(let y 6)(let y 7)";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      new TranspileError('Variable "y" is already defined!')
    );
  });

  test("`(const y 5)(scope (const y 3) (timesF y 2))`", () => {
    const src = "(const y 5)(scope (const y 3) (timesF y 2))";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      6
    );
  });

  test("`(let y 6)(scope (let y 7) (dividedByF y 2))`", () => {
    const src = "(let y 6)(scope (let y 7) (dividedByF y 2))";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      3.5
    );
  });

  test("`(const y 5)(scope (const y 3) (plusF y 0)) (timesF y 2)`", () => {
    const src = "(const y 5)(scope (const y 3) (plusF y 0)) (timesF y 2)";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      10
    );
  });

  test("`(let y 6)(scope (let y 7) (plusF y 0)) (dividedByF y 3)`", () => {
    const src = "(let y 6)(scope (let y 7) (plusF y 0)) (dividedByF y 3)";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      2
    );
  });

  test("`(scope (const y 3))`", () => {
    const src = "(scope (const y 3))";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      new TranspileError(
        "The last statement in a `scope` must be an expression!"
      )
    );
  });

  test("`(scope (let x 7) (let y 7))`", () => {
    const src = "(scope (let x 7) (let y 7))";
    expect(evalBlock(assertNonError(readBlock(src)), Env.init(base()))).toEqual(
      new TranspileError(
        "The last statement in a `scope` must be an expression!"
      )
    );
  });
});
