import { assertNonError } from "./util/error";

import * as Env from "./env.js";
import { readBlock, readStr } from "./reader";
import { evalForm, evalBlock } from "./eval";
import { describe, expect, test } from "vitest";
import { TranspileError } from "./types";
import { base } from "./lib/base";

describe("evalForm", () => {
  function testOf({ src, expected }: { src: string; expected: any }): void {
    test(`\`${src}\` => ${expected}`, () => {
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        expected
      );
    });
  }

  testOf({ src: "( plusF 2.0 (timesF 3.0 4.0) )", expected: 14 });
  testOf({
    src: '(eval "1")',
    expected: new TranspileError('No function "eval" is defined!'),
  });
  testOf({
    src: "(plusF eval eval)",
    expected: new TranspileError('No variable "eval" is defined!'),
  });

  describe("(if bool x else y)", () => {
    testOf({ src: "(if True 1 else 2)", expected: 1 });
    testOf({ src: "(if False 1 else 2)", expected: 2 });
    testOf({
      src: "(scope (let x 0) (if True (assign x 1) x else (assign x 2) x))",
      expected: 1,
    });
    testOf({
      src: "(scope (let x 0) (if False (assign x 1) x else (assign x 2) x))",
      expected: 2,
    });
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testOf({ src: "( (fn (x) (plusF x 3)) 2 )", expected: 5 });
  });

  describe("(equals x y)", () => {
    testOf({ src: '(scope (const x "123") (equals x "123"))', expected: true });

    testOf({ src: '(scope (const x "123") (equals x 123))', expected: false });
  });

  describe("(notEquals x y)", () => {
    testOf({ src: "(scope (const x 123) (notEquals x 123))", expected: false });
    testOf({
      src: '(scope (const x 123) (notEquals x "123"))',
      expected: true,
    });
  });

  describe("(isLessThan x y)", () => {
    testOf({ src: "(scope (const x 123) (isLessThan x 124))", expected: true });

    testOf({
      src: "(scope (const x 123) (isLessThan x 123))",
      expected: false,
    });

    testOf({
      src: "(scope (const x 123) (isLessThan x 122))",
      expected: false,
    });
  });

  describe("(isLessThanOrEquals x y)", () => {
    testOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 124))",
      expected: true,
    });

    testOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 123))",
      expected: true,
    });

    testOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 122))",
      expected: false,
    });
  });

  describe("(isGreaterThan x y)", () => {
    testOf({
      src: "(scope (const x 123) (isGreaterThan x 124))",
      expected: false,
    });

    testOf({
      src: "(scope (const x 123) (isGreaterThan x 123))",
      expected: false,
    });

    testOf({
      src: "(scope (const x 123) (isGreaterThan x 122))",
      expected: true,
    });
  });

  describe("(isGreaterThanOrEquals x y)", () => {
    testOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 124))",
      expected: false,
    });

    testOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 123))",
      expected: true,
    });

    testOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 122))",
      expected: true,
    });
  });
});

describe("evalBlock", () => {
  function testOf({ src, expected }: { src: string; expected: any }): void {
    test(`\`${src}\` => ${expected}`, () => {
      expect(
        evalBlock(assertNonError(readBlock(src)), Env.init(base()))
      ).toEqual(expected);
    });
  }

  testOf({
    src: "(const x (timesF 3 3))(plusF x 2)",
    expected: 11,
  });

  testOf({
    src: "(let y (dividedByF 3 2))(assign y (plusF y 2))(minusF y 6)",
    expected: -2.5,
  });

  testOf({
    src: "(const y 5)(const y 3)",
    expected: new TranspileError('Variable "y" is already defined!'),
  });

  testOf({
    src: "(let y 6)(let y 7)",
    expected: new TranspileError('Variable "y" is already defined!'),
  });

  testOf({ src: "(const y 5)(scope (const y 3) (timesF y 2))", expected: 6 });

  testOf({ src: "(let y 6)(scope (let y 7) (dividedByF y 2))", expected: 3.5 });

  testOf({
    src: "(const y 5)(scope (const y 3) (plusF y 0)) (timesF y 2)",
    expected: 10,
  });

  testOf({
    src: "(let y 6)(scope (let y 7) (plusF y 0)) (dividedByF y 3)",
    expected: 2,
  });

  testOf({
    src: "(scope (const y 3))",
    expected: new TranspileError(
      "The last statement in a `scope` must be an expression!"
    ),
  });

  testOf({
    src: "(scope (let x 7) (let y 7))",
    expected: new TranspileError(
      "The last statement in a `scope` must be an expression!"
    ),
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testOf({
      src:
        "(const a 2.5) (const f (fn (x) (const b 3) (minusF (timesF a x) b))) (f 9)",
      expected: 19.5,
    });
  });
});
