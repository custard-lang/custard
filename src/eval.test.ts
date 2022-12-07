import { assertNonError } from "./util/error";

import * as Env from "./env.js";
import { readBlock, readStr } from "./reader";
import { evalForm, evalBlock } from "./eval";

import { describe, expect, test } from "vitest";
import { TranspileError } from "./types";
import { base } from "./lib/base";

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
    t(`\`${src}\` => ${expected}`, () => {
      expect(evalForm(assertNonError(readStr(src)), Env.init(base()))).toEqual(
        expected,
      );
    });
  }

  testOf({ src: "( plusF 2.0 (timesF 3.0 4.0) )", expected: 14 });
  testOf({
    src: '(eval "1")',
    expected: new TranspileError(
      "No variable `eval` is defined! NOTE: If you want to define `eval` recursively, wrap the declaration(s) with `recursive`.",
    ),
  });
  testOf({
    src: "(plusF eval eval)",
    expected: new TranspileError(
      "No variable `eval` is defined! NOTE: If you want to define `eval` recursively, wrap the declaration(s) with `recursive`.",
    ),
  });

  describe("(if bool x else y)", () => {
    testOf({ src: "(if true 1 else 2)", expected: 1 });
    testOf({ src: "(if false 1 else 2)", expected: 2 });
    testOf({
      src: "(if)",
      expected: new TranspileError(
        "No expressions given to an `if` expression!",
      ),
    });
    testOf({
      src: "(if false)",
      expected: new TranspileError(
        "No expressions given to an `if` expression!",
      ),
    });
    testOf({
      src: "(if false else 2)",
      expected: new TranspileError("No expressions specified before `else`!"),
    });
    testOf({
      src: "(if false 1 2)",
      expected: new TranspileError(
        "`else` not specified for an `if` expression!",
      ),
    });
    testOf({
      src: "(if false 1 else)",
      expected: new TranspileError("No expressions specified after `else`!"),
    });
    testOf({
      src: "(if false 1 else else 2)",
      expected: new TranspileError(
        "`else` is specified more than once in an `if` expression!",
      ),
    });
    testOf({
      src: "(if false 1 else 2 else 2)",
      expected: new TranspileError(
        "`else` is specified more than once in an `if` expression!",
      ),
    });
    testOf({
      src: "(scope (let x 0) (if true (assign x 1) x else (assign x 2) x))",
      expected: 1,
    });
    testOf({
      src: "(scope (let x 0) (if false (assign x 1) x else (assign x 2) x))",
      expected: 2,
    });
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testOf({ src: "( (fn (x) (plusF x 3)) 2 )", expected: 5 });
    testOf({ src: "( (fn () 3) 2 )", expected: 3 });
    testOf({
      src: "((fn ()))",
      expected: new TranspileError(
        "`fn` must receive at least one expression!",
      ),
    });
    testOf({
      src: "( (fn x x) 1 )",
      expected: new TranspileError(
        'Arguments for a function must be an array of symbols! But actually {"t":"Symbol","v":"x"}',
      ),
    });
    testOf({
      src: "( (fn (x 1) x) 1 )",
      expected: new TranspileError(
        'Arguments for a function must be an array of symbols! But actually [{"t":"Symbol","v":"x"},{"t":"Integer32","v":1}]',
      ),
    });
  });

  describe("(scope e x p r s)", () => {
    testOf({
      src: "(scope)",
      expected: new TranspileError(
        "`scope` must receive at least one expression!",
      ),
    });
    testOf({
      src: "(scope (const y 3))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `const` is a statement!",
      ),
    });
    testOf({
      src: "(scope (let x 7) (let y 7))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `let` is a statement!",
      ),
    });
    testOf({
      src: "(scope (forEach x (array 1 2 3)))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `forEach` is a statement!",
      ),
    });
    testOf({
      src: "(scope (return 904) 22)",
      expected: 904,
    });
    testOf({
      src: "(scope (return 904))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `return` is a statement!",
      ),
    });
    testOf({
      src: "(scope (recursive const x = 1))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `recursive` is a statement!",
      ),
    });
    testOf({
      src: "(scope (return) 1)",
      expected: undefined,
    });
    testOf({
      src: "(scope (return undefined) 1)",
      expected: undefined,
    });
    testOf({
      src: "(scope (return 904 905) 1)",
      expected: new TranspileError(
        "`return` must receive at most one expression!",
      ),
    });
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

  describe("(and x y)", () => {
    testOf({ src: "(and true true)", expected: true });
    testOf({ src: "(and false true)", expected: false });
    testOf({ src: "(and true false)", expected: false });
    testOf({ src: "(and false false)", expected: false });
  });

  describe("(or x y)", () => {
    testOf({ src: "(or true true)", expected: true });
    testOf({ src: "(or false true)", expected: true });
    testOf({ src: "(or true false)", expected: true });
    testOf({ src: "(or false false)", expected: false });
  });

  describe("(not x)", () => {
    testOf({ src: "(not true)", expected: false });
    testOf({ src: "(not false)", expected: true });
    testOf({
      src: "(not false false)",
      expected: new TranspileError(
        "`not` must receive exactly one expression!",
      ),
    });
  });

  describe("(array f o r m s)", () => {
    testOf({ src: "(array 1 2 3)", expected: [1, 2, 3] });
    testOf({ src: "(array)", expected: [] });
    testOf({
      src: "(array 1 (if (isLessThan 2 3) 4 else 5) 6)",
      expected: [1, 4, 6],
    });
    testOf({
      src: "(array 1 6 (if (isLessThan 2 3) 4 else 5))",
      expected: [1, 6, 4],
    });
    testOf({
      src: "(array (if (isLessThan 2 3) 4 else 5) 1 6)",
      expected: [4, 1, 6],
    });
  });
});

describe("evalBlock", () => {
  function testOf({
    src,
    expected,
    only,
  }: {
    src: string;
    expected: any;
    only?: true | undefined;
  }): void {
    const t = only ? test.only : test;
    t(`\`${src}\` => ${expected}`, () => {
      expect(
        evalBlock(assertNonError(readBlock(src)), Env.init(base())),
      ).toEqual(expected);
    });
  }

  describe("(const|let|assign id expression)", () => {
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
      src: "(const y 5)(assign y 3)",
      expected: new TranspileError('Variable "y" is NOT declared by `let`!'),
    });

    testOf({
      src: "(let y 6)(let y 7)",
      expected: new TranspileError('Variable "y" is already defined!'),
    });

    testOf({ src: "(const y 5)(scope (const y 3) (timesF y 2))", expected: 6 });

    testOf({
      src: "(let y 6)(scope (let y 7) (dividedByF y 2))",
      expected: 3.5,
    });

    testOf({
      src: "(const y 5)(scope (const y 3) (plusF y 0)) (timesF y 2)",
      expected: 10,
    });

    testOf({
      src: "(let y 6)(scope (let y 7) (plusF y 0)) (dividedByF y 3)",
      expected: 2,
    });

    testOf({
      src: "(const y 3 2)",
      expected: new TranspileError(
        "The number of arguments to `const` must be 2!",
      ),
    });

    testOf({
      src: "(let y 4 5)",
      expected: new TranspileError(
        "The number of arguments to `let` must be 2!",
      ),
    });

    testOf({
      src: "(let y 8)(assign y 9 10))",
      expected: new TranspileError(
        "The number of arguments to `assign` must be 2!",
      ),
    });
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testOf({
      src: "(const a 2.5) (const f (fn (x) (const b 3) (minusF (timesF a x) b))) (f 9)",
      expected: 19.5,
    });

    testOf({
      src: "(const f (fn (x) (return 904) x)) (f 9)",
      expected: 904,
    });

    testOf({
      src: "(const f (fn (x) (return 904))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `return` is a statement!",
      ),
    });

    testOf({
      src: "(const f (fn (x) (when x x))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `when` is a statement!",
      ),
    });

    testOf({
      src: "(const f (fn (x) (incrementF x))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `incrementF` is a statement!",
      ),
    });

    testOf({
      src: "(const f (fn (x) (decrementF x))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `decrementF` is a statement!",
      ),
    });
  });

  describe("(procedure (a r g s) f o r m s)", () => {
    testOf({
      src: "(const p (procedure () (let x 6) (when false (return 9))))(p)",
      expected: undefined,
    });
    testOf({
      src: "(let n 0) (const p (procedure (x) (assign n (plusF 45 x)) (when true (return n)) -1)) (p 3)",
      expected: 48,
    });
  });

  describe("(when bool f o r m s)", () => {
    testOf({
      src: "(let x -2) (when true (let y 905) (assign x (plusF x y))) x",
      expected: 903,
    });
    testOf({
      src: "(let x -2) (when false (let y 905) (assign x (plusF x y))) x",
      expected: -2,
    });
    testOf({
      src: "(when)",
      expected: new TranspileError(
        "No expressions given to a `when` statement!",
      ),
    });
    testOf({
      src: "(when true)",
      expected: new TranspileError(
        "No statements given to a `when` statement!",
      ),
    });
  });

  describe("(while bool f o r m s)", () => {
    testOf({
      src: "(let x 8)(while (isLessThan x 100) (assign x (minusF x 1)) (assign x (timesF x 2))) x",
      expected: 194,
    });
    testOf({
      src: "(let x 8)(while (isLessThan x 100) (let x 7) (assign x (dividedByF x 2)) (break)) x",
      expected: 8,
    });
    testOf({
      src: "(while)",
      expected: new TranspileError(
        "No conditional expression given to a `while` statement!",
      ),
    });
    testOf({
      src: "(while false)",
      expected: new TranspileError(
        "No statements given to a `while` statement!",
      ),
    });
  });

  describe("(for init bool final f o r m s)", () => {
    testOf({
      src: "(let y 0) (for (let x 8) (isLessThan x 100) (assign x (timesF x 2)) (assign x (minusF x 1)) (assign y x)) y",
      expected: 97,
    });
    testOf({
      src: "(let y 0) (for (let x 8) (isLessThan x 100) (incrementF x) (assign x (minusF x 0.5)) (assign y x) (continue) (decrementF x)) y",
      expected: 99,
    });
    testOf({
      src: "(for)",
      expected: new TranspileError(
        "No initialization statement given to a `for` statement!",
      ),
    });
    testOf({
      src: "(for (let x 0))",
      expected: new TranspileError(
        "No conditional expression given to a `for` statement!",
      ),
    });
    testOf({
      src: "(for (let x 0) false)",
      expected: new TranspileError(
        "No final expression given to a `for` statement!",
      ),
    });
    testOf({
      src: "(for (let x 0) false (addF x))",
      expected: new TranspileError("No statements given to a `for` statement!"),
    });
  });

  describe("(incrementF id)", () => {
    testOf({
      src: "(let x 0)(incrementF x) x",
      expected: 1,
    });
    testOf({
      src: "(let x 0)(incrementF x 2) x",
      expected: new TranspileError(
        "`incrementF` must receive only one symbol!",
      ),
    });
    testOf({
      src: "(const x 0)(incrementF x) x",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable declared by `let`!",
      ),
    });
    testOf({
      src: "(incrementF 0) 1",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable!",
      ),
    });
    testOf({
      src: "(incrementF decrementF) 1",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable declared by `let`!",
      ),
    });
    testOf({
      src: "(incrementF unknown) 1",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable declared by `let`!",
      ),
    });
  });

  describe("(decrementF id)", () => {
    testOf({
      src: "(let x 0)(decrementF x) x",
      expected: -1,
    });
    testOf({
      src: "(let x 0)(decrementF x 2) x",
      expected: new TranspileError(
        "`decrementF` must receive only one symbol!",
      ),
    });
    testOf({
      src: "(const x 0)(decrementF x) x",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable declared by `let`!",
      ),
    });
    testOf({
      src: "(decrementF 0) 1",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable!",
      ),
    });
    testOf({
      src: "(decrementF incrementF) 1",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable declared by `let`!",
      ),
    });
    testOf({
      src: "(decrementF unknown) 1",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable declared by `let`!",
      ),
    });
  });

  describe("(forEach id iterable s t a t e m e n t s)", () => {
    testOf({
      src: "(let x 0)(forEach v (array 1 2 3) (assign x (plusF x v))) x",
      expected: 6,
    });
    testOf({
      src: "(let v 0)(scope (let x 2) (forEach v (array 1 2 3) (assign x (plusF x v))) x)",
      expected: 8,
    });
    testOf({
      src: "(let x 0)(let v 0)(forEach x (array 7 8 9) (assign v (plusF x v))) v",
      expected: 24,
    });
    testOf({
      src: "(forEach v (array 1 2 3))",
      expected: new TranspileError(
        "No statements given to a `forEach` statement!",
      ),
    });
    testOf({
      src: "(forEach v)",
      expected: new TranspileError(
        "No iterable expression given to a `forEach` statement!",
      ),
    });
    testOf({
      src: "(forEach)",
      expected: new TranspileError(
        "No variable name given to a `forEach` statement!",
      ),
    });
  });

  describe("recursive calls", () => {
    testOf({
      src: "(const f (fn (x) (return 1) (f x)))",
      expected: new TranspileError(
        "No variable `f` is defined! NOTE: If you want to define `f` recursively, wrap the declaration(s) with `recursive`.",
      ),
    });
    testOf({
      src: "(const f (fn (x) (return 1) (g x))) (const g (fn (x) (return 2) (f x)))",
      expected: new TranspileError(
        "No variable `g` is defined! NOTE: If you want to define `g` recursively, wrap the declaration(s) with `recursive`.",
      ),
    });

    testOf({
      src: "(recursive (const f (fn (x) (return 1) (f x)))) (f 0)",
      expected: 1,
    });
    testOf({
      src: "(recursive (const f (fn (x) (return 1) (g x))) (const g (fn (x) (return 2) (f x)))) (g 0)",
      expected: 2,
    });

    testOf({
      src: "(const f (fn (x) 1))(scope (const f (fn (x) (return 2) (f x))) (f 0))",
      expected: new TranspileError(
        "No variable `f` is defined! NOTE: If you want to define `f` recursively, wrap the declaration(s) with `recursive`.",
      ),
    });

    testOf({
      src: "(const g (fn () 1))(scope (const f (fn (x) (return 2) (g))) (const g (fn () (return 3) (f 1))) (f 0))",
      expected: new TranspileError(
        "No variable `g` is defined! NOTE: If you want to define `g` recursively, wrap the declaration(s) with `recursive`.",
      ),
    });
  });

  describe("(recursive d e c l a r a t i o n s)", () => {
    testOf({
      src: "(recursive (let x 1))",
      expected: new TranspileError(
        "All declarations in `recursive` must be `const`!",
      ),
    });
    testOf({
      src: "(recursive (const))",
      expected: new TranspileError("undefined is not a symbol!"),
    });
    testOf({
      src: '(recursive "")',
      expected: new TranspileError(
        "All arguments in `recursive` must be `const` declarations!",
      ),
    });
    testOf({
      src: "(recursive)",
      expected: new TranspileError(
        "No `const` statements given to `recursive`!",
      ),
    });
  });
});
