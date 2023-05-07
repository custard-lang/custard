import { describe } from "vitest";
import { testEvalBlockOf, testEvalFormOf } from "../util/test-expectations";

import { ReplOptions, replOptionsFromBuiltinModulePath } from "../repl";
import { TranspileError } from "../types";
import { standardModuleRoot } from "../definitions";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-assignment */

function setUpReplOptions(): ReplOptions {
  return replOptionsFromBuiltinModulePath(`${standardModuleRoot}/base.js`);
}

describe("evalForm", () => {
  testEvalFormOf({
    src: "( plusF 2.0 (timesF 3.0 4.0) )",
    expected: 14,
    setUpReplOptions,
  });
  testEvalFormOf({
    src: '(eval "1")',
    expected: new TranspileError(
      "No variable `eval` is defined! NOTE: If you want to define `eval` recursively, wrap the declaration(s) with `recursive`.",
    ),
    setUpReplOptions,
  });
  testEvalFormOf({
    src: "(plusF eval eval)",
    expected: new TranspileError(
      "No variable `eval` is defined! NOTE: If you want to define `eval` recursively, wrap the declaration(s) with `recursive`.",
    ),
    setUpReplOptions,
  });

  describe("(if bool x else y)", () => {
    testEvalFormOf({
      src: "(if true 1 else 2)",
      expected: 1,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if false 1 else 2)",
      expected: 2,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if)",
      expected: new TranspileError(
        "No expressions given to an `if` expression!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if false)",
      expected: new TranspileError(
        "No expressions given to an `if` expression!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if false else 2)",
      expected: new TranspileError("No expressions specified before `else`!"),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if false 1 2)",
      expected: new TranspileError(
        "`else` not specified for an `if` expression!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if false 1 else)",
      expected: new TranspileError("No expressions specified after `else`!"),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if false 1 else else 2)",
      expected: new TranspileError(
        "`else` is specified more than once in an `if` expression!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(if false 1 else 2 else 2)",
      expected: new TranspileError(
        "`else` is specified more than once in an `if` expression!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (let x 0) (if true (assign x 1) x else (assign x 2) x))",
      expected: 1,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (let x 0) (if false (assign x 1) x else (assign x 2) x))",
      expected: 2,
      setUpReplOptions,
    });
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testEvalFormOf({
      src: "( (fn (x) (plusF x 3)) 2 )",
      expected: 5,
      setUpReplOptions,
    });
    testEvalFormOf({ src: "( (fn () 3) 2 )", expected: 3, setUpReplOptions });
    testEvalFormOf({
      src: "((fn ()))",
      expected: new TranspileError(
        "`fn` must receive at least one expression!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "( (fn x x) 1 )",
      expected: new TranspileError(
        'Arguments for a function must be an array of symbols! But actually {"t":"Symbol","v":"x"}',
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "( (fn (x 1) x) 1 )",
      expected: new TranspileError(
        'Arguments for a function must be an array of symbols! But actually [{"t":"Symbol","v":"x"},{"t":"Integer32","v":1}]',
      ),
      setUpReplOptions,
    });
  });

  describe("(scope e x p r s)", () => {
    testEvalFormOf({
      src: "(scope)",
      expected: new TranspileError(
        "`scope` must receive at least one expression!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const y 3))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `const` is a statement!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (let x 7) (let y 7))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `let` is a statement!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (forEach x (array 1 2 3)))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `forEach` is a statement!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (return 904) 22)",
      expected: 904,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (return 904))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `return` is a statement!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (recursive const x = 1))",
      expected: new TranspileError(
        "The last statement in a `scope` must be an expression! But `recursive` is a statement!",
      ),
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (return) 1)",
      expected: undefined,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (return undefined) 1)",
      expected: undefined,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (return 904 905) 1)",
      expected: new TranspileError(
        "`return` must receive at most one expression!",
      ),
      setUpReplOptions,
    });
  });

  describe("(equals x y)", () => {
    testEvalFormOf({
      src: '(scope (const x "123") (equals x "123"))',
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: '(scope (const x "123") (equals x 123))',
      expected: false,
      setUpReplOptions,
    });
  });

  describe("(notEquals x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (notEquals x 123))",
      expected: false,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: '(scope (const x 123) (notEquals x "123"))',
      expected: true,
      setUpReplOptions,
    });
  });

  describe("(isLessThan x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThan x 124))",
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThan x 123))",
      expected: false,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThan x 122))",
      expected: false,
      setUpReplOptions,
    });
  });

  describe("(isLessThanOrEquals x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 124))",
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 123))",
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 122))",
      expected: false,
      setUpReplOptions,
    });
  });

  describe("(isGreaterThan x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThan x 124))",
      expected: false,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThan x 123))",
      expected: false,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThan x 122))",
      expected: true,
      setUpReplOptions,
    });
  });

  describe("(isGreaterThanOrEquals x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 124))",
      expected: false,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 123))",
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 122))",
      expected: true,
      setUpReplOptions,
    });
  });

  describe("(and x y)", () => {
    testEvalFormOf({
      src: "(and true true)",
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(and false true)",
      expected: false,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(and true false)",
      expected: false,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(and false false)",
      expected: false,
      setUpReplOptions,
    });
  });

  describe("(or x y)", () => {
    testEvalFormOf({ src: "(or true true)", expected: true, setUpReplOptions });
    testEvalFormOf({
      src: "(or false true)",
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(or true false)",
      expected: true,
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(or false false)",
      expected: false,
      setUpReplOptions,
    });
  });

  describe("(not x)", () => {
    testEvalFormOf({ src: "(not true)", expected: false, setUpReplOptions });
    testEvalFormOf({ src: "(not false)", expected: true, setUpReplOptions });
    testEvalFormOf({
      src: "(not false false)",
      expected: new TranspileError(
        "`not` must receive exactly one expression!",
      ),
      setUpReplOptions,
    });
  });

  describe("(text f o r m s)", () => {
    testEvalFormOf({
      src: '(text "$ " false "` " 1)',
      expected: "$ false` 1",
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(text)",
      expected: "",
      setUpReplOptions,
    });
  });

  describe("(array f o r m s)", () => {
    testEvalFormOf({
      src: "(array 1 2 3)",
      expected: [1, 2, 3],
      setUpReplOptions,
    });
    testEvalFormOf({ src: "(array)", expected: [], setUpReplOptions });
    testEvalFormOf({
      src: "(array 1 (if (isLessThan 2 3) 4 else 5) 6)",
      expected: [1, 4, 6],
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(array 1 6 (if (isLessThan 2 3) 4 else 5))",
      expected: [1, 6, 4],
      setUpReplOptions,
    });
    testEvalFormOf({
      src: "(array (if (isLessThan 2 3) 4 else 5) 1 6)",
      expected: [4, 1, 6],
      setUpReplOptions,
    });
  });
});

describe("evalBlock", () => {
  describe("(const|let|assign id expression)", () => {
    testEvalBlockOf({
      src: "(const x (timesF 3 3))(plusF x 2)",
      expected: 11,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(let y (dividedByF 3 2))(assign y (plusF y 2))(minusF y 6)",
      expected: -2.5,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const y 5)(const y 3)",
      expected: new TranspileError('Variable "y" is already defined!'),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const y 5)(assign y 3)",
      expected: new TranspileError('Variable "y" is NOT declared by `let`!'),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(let y 6)(let y 7)",
      expected: new TranspileError('Variable "y" is already defined!'),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const y 5)(scope (const y 3) (timesF y 2))",
      expected: 6,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(let y 6)(scope (let y 7) (dividedByF y 2))",
      expected: 3.5,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const y 5)(scope (const y 3) (plusF y 0)) (timesF y 2)",
      expected: 10,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(let y 6)(scope (let y 7) (plusF y 0)) (dividedByF y 3)",
      expected: 2,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const y 3 2)",
      expected: new TranspileError(
        "The number of arguments to `const` must be 2!",
      ),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(let y 4 5)",
      expected: new TranspileError(
        "The number of arguments to `let` must be 2!",
      ),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(let y 8)(assign y 9 10))",
      expected: new TranspileError(
        "The number of arguments to `assign` must be 2!",
      ),
      setUpReplOptions,
    });
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testEvalBlockOf({
      src: "(const a 2.5) (const f (fn (x) (const b 3) (minusF (timesF a x) b))) (f 9)",
      expected: 19.5,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (return 904) x)) (f 9)",
      expected: 904,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (return 904))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `return` is a statement!",
      ),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (when x x))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `when` is a statement!",
      ),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (incrementF x))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `incrementF` is a statement!",
      ),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (decrementF x))) (f 9)",
      expected: new TranspileError(
        "The last statement in a `fn` must be an expression! But `decrementF` is a statement!",
      ),
      setUpReplOptions,
    });
  });

  describe("(procedure (a r g s) f o r m s)", () => {
    testEvalBlockOf({
      src: "(const p (procedure () (let x 6) (when false (return 9))))(p)",
      expected: undefined,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let n 0) (const p (procedure (x) (assign n (plusF 45 x)) (when true (return n)) -1)) (p 3)",
      expected: 48,
      setUpReplOptions,
    });
  });

  describe("(when bool f o r m s)", () => {
    testEvalBlockOf({
      src: "(let x -2) (when true (let y 905) (assign x (plusF x y))) x",
      expected: 903,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let x -2) (when false (let y 905) (assign x (plusF x y))) x",
      expected: -2,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(when)",
      expected: new TranspileError(
        "No expressions given to a `when` statement!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(when true)",
      expected: new TranspileError(
        "No statements given to a `when` statement!",
      ),
      setUpReplOptions,
    });
  });

  describe("(while bool f o r m s)", () => {
    testEvalBlockOf({
      src: "(let x 8)(while (isLessThan x 100) (assign x (minusF x 1)) (assign x (timesF x 2))) x",
      expected: 194,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let x 8)(while (isLessThan x 100) (let x 7) (assign x (dividedByF x 2)) (break)) x",
      expected: 8,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(while)",
      expected: new TranspileError(
        "No conditional expression given to a `while` statement!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(while false)",
      expected: new TranspileError(
        "No statements given to a `while` statement!",
      ),
      setUpReplOptions,
    });
  });

  describe("(for init bool final f o r m s)", () => {
    testEvalBlockOf({
      src: "(let y 0) (for (let x 8) (isLessThan x 100) (assign x (timesF x 2)) (assign x (minusF x 1)) (assign y x)) y",
      expected: 97,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let y 0) (for (let x 8) (isLessThan x 100) (incrementF x) (assign x (minusF x 0.5)) (assign y x) (continue) (decrementF x)) y",
      expected: 99,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(for)",
      expected: new TranspileError(
        "No initialization statement given to a `for` statement!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(for (let x 0))",
      expected: new TranspileError(
        "No conditional expression given to a `for` statement!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(for (let x 0) false)",
      expected: new TranspileError(
        "No final expression given to a `for` statement!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(for (let x 0) false (addF x))",
      expected: new TranspileError("No statements given to a `for` statement!"),
      setUpReplOptions,
    });
  });

  describe("(incrementF id)", () => {
    testEvalBlockOf({
      src: "(let x 0)(incrementF x) x",
      expected: 1,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let x 0)(incrementF x 2) x",
      expected: new TranspileError(
        "`incrementF` must receive only one symbol!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(const x 0)(incrementF x) x",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable declared by `let`!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(incrementF 0) 1",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(incrementF decrementF) 1",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable declared by `let`!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(incrementF unknown) 1",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable declared by `let`!",
      ),
      setUpReplOptions,
    });
  });

  describe("(decrementF id)", () => {
    testEvalBlockOf({
      src: "(let x 0)(decrementF x) x",
      expected: -1,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let x 0)(decrementF x 2) x",
      expected: new TranspileError(
        "`decrementF` must receive only one symbol!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(const x 0)(decrementF x) x",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable declared by `let`!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(decrementF 0) 1",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(decrementF incrementF) 1",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable declared by `let`!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(decrementF unknown) 1",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable declared by `let`!",
      ),
      setUpReplOptions,
    });
  });

  describe("(forEach id iterable s t a t e m e n t s)", () => {
    testEvalBlockOf({
      src: "(let x 0)(forEach v (array 1 2 3) (assign x (plusF x v))) x",
      expected: 6,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let v 0)(scope (let x 2) (forEach v (array 1 2 3) (assign x (plusF x v))) x)",
      expected: 8,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(let x 0)(let v 0)(forEach x (array 7 8 9) (assign v (plusF x v))) v",
      expected: 24,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(forEach v (array 1 2 3))",
      expected: new TranspileError(
        "No statements given to a `forEach` statement!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(forEach v)",
      expected: new TranspileError(
        "No iterable expression given to a `forEach` statement!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(forEach)",
      expected: new TranspileError(
        "No variable name given to a `forEach` statement!",
      ),
      setUpReplOptions,
    });
  });

  describe("recursive calls", () => {
    testEvalBlockOf({
      src: "(const f (fn (x) (return 1) (f x)))",
      expected: new TranspileError(
        "No variable `f` is defined! NOTE: If you want to define `f` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(const f (fn (x) (return 1) (g x))) (const g (fn (x) (return 2) (f x)))",
      expected: new TranspileError(
        "No variable `g` is defined! NOTE: If you want to define `g` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(recursive (const f (fn (x) (return 1) (f x)))) (f 0)",
      expected: 1,
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(recursive (const f (fn (x) (return 1) (g x))) (const g (fn (x) (return 2) (f x)))) (g 0)",
      expected: 2,
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) 1))(scope (const f (fn (x) (return 2) (f x))) (f 0))",
      expected: new TranspileError(
        "No variable `f` is defined! NOTE: If you want to define `f` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpReplOptions,
    });

    testEvalBlockOf({
      src: "(const g (fn () 1))(scope (const f (fn (x) (return 2) (g))) (const g (fn () (return 3) (f 1))) (f 0))",
      expected: new TranspileError(
        "No variable `g` is defined! NOTE: If you want to define `g` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpReplOptions,
    });
  });

  describe("(recursive d e c l a r a t i o n s)", () => {
    testEvalBlockOf({
      src: "(recursive (let x 1))",
      expected: new TranspileError(
        "All declarations in `recursive` must be `const`!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(recursive (const))",
      expected: new TranspileError("undefined is not a symbol!"),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: '(recursive "")',
      expected: new TranspileError(
        "All arguments in `recursive` must be `const` declarations!",
      ),
      setUpReplOptions,
    });
    testEvalBlockOf({
      src: "(recursive)",
      expected: new TranspileError(
        "No `const` statements given to `recursive`!",
      ),
      setUpReplOptions,
    });
  });
});
