import { describe } from "vitest";
import { Config, testEvalBlockOf, testEvalFormOf } from "../test";
import * as path from "node:path";

import { defaultTranspileOptions, FilePath, TranspileError } from "../types";
import { standardModuleRoot } from "../definitions";
import { implicitlyImporting } from "../provided-symbols-config";
import { fileOfImportMetaUrl } from "../util/path";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-assignment */

const providedSymbols = {
  from: fileOfImportMetaUrl(import.meta.url),
  ...implicitlyImporting(`${standardModuleRoot}/base.js`),
};

function setUpConfig(): Config {
  return {
    options: defaultTranspileOptions(),
    providedSymbols,
  };
}

describe("evalForm", () => {
  describe("`note`", () => {
    testEvalFormOf({
      src: '(note "This is a comment")',
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: '(note "This is a comment" 1 2 3)',
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: '[(note "This is a comment")]',
      expected: [undefined],
      setUpConfig,
    });
  });

  testEvalFormOf({
    src: "( plusF 2.0 (timesF 3.0 4.0) )",
    expected: 14,
    setUpConfig,
  });
  testEvalFormOf({
    src: '(eval "1")',
    expected: new TranspileError(
      "No variable `eval` is defined! NOTE: If you want to define `eval` recursively, wrap the declaration(s) with `recursive`.",
    ),
    setUpConfig,
  });
  testEvalFormOf({
    src: "(plusF eval eval)",
    expected: new TranspileError(
      "No variable `eval` is defined! NOTE: If you want to define `eval` recursively, wrap the declaration(s) with `recursive`.",
    ),
    setUpConfig,
  });

  describe("(if bool x else y)", () => {
    testEvalFormOf({
      src: "(if true 1 else 2)",
      expected: 1,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if false 1 else 2)",
      expected: 2,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if)",
      expected: new TranspileError(
        "No expressions given to an `if` expression!",
      ),
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if false)",
      expected: new TranspileError(
        "No expressions given to an `if` expression!",
      ),
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if false else 2)",
      expected: new TranspileError("No expressions specified before `else`!"),
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if false 1 2)",
      expected: new TranspileError(
        "`else` not specified for an `if` expression!",
      ),
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if false 1 else)",
      expected: new TranspileError("No expressions specified after `else`!"),
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if false 1 else else 2)",
      expected: new TranspileError(
        "`else` is specified more than once in an `if` expression!",
      ),
      setUpConfig,
    });
    testEvalFormOf({
      src: "(if false 1 else 2 else 2)",
      expected: new TranspileError(
        "`else` is specified more than once in an `if` expression!",
      ),
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (let x 0) (if true (assign x 1) x else (assign x 2) x))",
      expected: 1,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (let x 0) (if false (assign x 1) x else (assign x 2) x))",
      expected: 2,
      setUpConfig,
    });
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testEvalFormOf({
      src: "( (fn (x) (plusF x 3)) 2 )",
      expected: 5,
      setUpConfig,
    });
    testEvalFormOf({
      src: "( (fn (x y) (plusF x y)) 2 5 )",
      expected: 7,
      setUpConfig,
    });
    testEvalFormOf({
      src: "( (fn ({ x, y }) (plusF x y)) { x: 1, y: 9 } )",
      expected: 10,
      setUpConfig,
    });
    testEvalFormOf({
      src: "( (fn ({ x: v1, y: v2 }) (minusF v1 v2)) { x: 1, y: 9 } )",
      expected: -8,
      setUpConfig,
    });
    testEvalFormOf({ src: "( (fn () 3) 2 )", expected: 3, setUpConfig });
    testEvalFormOf({
      src: "((fn ()))",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "((fn () (const y 3)))",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "( (fn x x) 1 )",
      expected: new TranspileError(
        'Arguments for a function must be a list of symbols! But actually {"t":"Symbol","v":"x"}',
      ),
      setUpConfig,
    });
    testEvalFormOf({
      src: "( (fn (x 1) x) 1 )",
      expected: new TranspileError(
        `fn's assignee must be a symbol or an object literal, but {"t":"Integer32","v":1} is not!`,
      ),
      setUpConfig,
    });
    testEvalFormOf({
      src: "( (fn (x x) x) 1 )",
      expected: new TranspileError('Variable "x" is already defined!'),
      setUpConfig,
    });
  });

  describe("(scope e x p r s)", () => {
    testEvalFormOf({
      src: "(scope)",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const y 3))",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (let x 7) (let y 7))",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (forEach x [1 2 3]))",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (return 904) 22)",
      expected: 904,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (return 904))",
      expected: 904,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (recursive (const x 1)))",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (return) 1)",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (return none) 1)",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (return 904 905) 1)",
      expected: new TranspileError(
        "`return` must receive at most one expression!",
      ),
      setUpConfig,
    });
  });

  describe("(equals x y)", () => {
    testEvalFormOf({
      src: '(scope (const x "123") (equals x "123"))',
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: '(scope (const x "123") (equals x 123))',
      expected: false,
      setUpConfig,
    });
  });

  describe("(notEquals x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (notEquals x 123))",
      expected: false,
      setUpConfig,
    });
    testEvalFormOf({
      src: '(scope (const x 123) (notEquals x "123"))',
      expected: true,
      setUpConfig,
    });
  });

  describe("(isLessThan x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThan x 124))",
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThan x 123))",
      expected: false,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThan x 122))",
      expected: false,
      setUpConfig,
    });
  });

  describe("(isLessThanOrEquals x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 124))",
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 123))",
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isLessThanOrEquals x 122))",
      expected: false,
      setUpConfig,
    });
  });

  describe("(isGreaterThan x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThan x 124))",
      expected: false,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThan x 123))",
      expected: false,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThan x 122))",
      expected: true,
      setUpConfig,
    });
  });

  describe("(isGreaterThanOrEquals x y)", () => {
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 124))",
      expected: false,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 123))",
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(scope (const x 123) (isGreaterThanOrEquals x 122))",
      expected: true,
      setUpConfig,
    });
  });

  describe("(isNone x)", () => {
    function setUpConfigWithJs(): Config {
      const config = setUpConfig();
      return {
        ...config,
        providedSymbols: {
          ...config.providedSymbols,
          ...implicitlyImporting(
            `${standardModuleRoot}/base.js`,
            `${standardModuleRoot}/js.js`,
          ),
        },
      };
    }

    testEvalFormOf({
      src: "(isNone null)",
      expected: true,
      setUpConfig: setUpConfigWithJs,
    });
    testEvalFormOf({
      src: "(isNone  undefined)",
      expected: true,
      setUpConfig: setUpConfigWithJs,
    });

    testEvalFormOf({
      src: "(isNone 0)",
      expected: false,
      setUpConfig: setUpConfigWithJs,
    });
    testEvalFormOf({
      src: '(isNone "")',
      expected: false,
      setUpConfig: setUpConfigWithJs,
    });
    testEvalFormOf({
      src: "(isNone [])",
      expected: false,
      setUpConfig: setUpConfigWithJs,
    });
    testEvalFormOf({
      src: "(isNone {})",
      expected: false,
      setUpConfig: setUpConfigWithJs,
    });
  });

  describe("(and x y)", () => {
    testEvalFormOf({
      src: "(and true true)",
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(and false true)",
      expected: false,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(and true false)",
      expected: false,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(and false false)",
      expected: false,
      setUpConfig,
    });
  });

  describe("(or x y)", () => {
    testEvalFormOf({ src: "(or true true)", expected: true, setUpConfig });
    testEvalFormOf({
      src: "(or false true)",
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(or true false)",
      expected: true,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(or false false)",
      expected: false,
      setUpConfig,
    });
  });

  describe("(not x)", () => {
    testEvalFormOf({ src: "(not true)", expected: false, setUpConfig });
    testEvalFormOf({ src: "(not false)", expected: true, setUpConfig });
    testEvalFormOf({
      src: "(not false false)",
      expected: new TranspileError(
        "`not` must receive exactly one expression!",
      ),
      setUpConfig,
    });
  });

  describe("(text f o r m s)", () => {
    testEvalFormOf({
      src: '(text "$ " false "` \\\\" 1)',
      expected: "$ false` \\1",
      setUpConfig,
    });
    testEvalFormOf({
      src: "(text)",
      expected: "",
      setUpConfig,
    });
  });

  describe("[a r r a y]", () => {
    testEvalFormOf({
      src: "[1 2 3]",
      expected: [1, 2, 3],
      setUpConfig,
    });
    testEvalFormOf({ src: "[]", expected: [], setUpConfig });
    testEvalFormOf({
      src: "[1 (if (isLessThan 2 3) 4 else 5) 6]",
      expected: [1, 4, 6],
      setUpConfig,
    });
    testEvalFormOf({
      src: "[1 6 (if (isLessThan 2 3) 4 else 5)]",
      expected: [1, 6, 4],
      setUpConfig,
    });
    testEvalFormOf({
      src: "[(if (isLessThan 2 3) 4 else 5) 1 6]",
      expected: [4, 1, 6],
      setUpConfig,
    });
  });

  describe('{object: "literal"}', () => {
    testEvalFormOf({
      src: '{ a: 1 [(scope "b")]: 3 [(plusF 1 1)]: 2 }',
      expected: { a: 1, b: 3, "2": 2 },
      setUpConfig,
    });
  });

  function setUpConfigOfTranspileOptions(srcPath: FilePath): () => Config {
    return () => ({
      options: { srcPath },
      providedSymbols,
    });
  }

  describe("cu$thisFile", () => {
    const thisFilePath = fileOfImportMetaUrl(import.meta.url);
    const thisFilePathRelative = path.relative(process.cwd(), thisFilePath);
    testEvalFormOf({
      src: "cu$thisFile",
      expected: path.normalize(thisFilePath),
      setUpConfig: setUpConfigOfTranspileOptions(thisFilePathRelative),
    });

    testEvalFormOf({
      src: "cu$thisFile",
      expected: new TranspileError(
        `${process.cwd()} is a directory! \`cu$thisFile\` is only allowed in a file`,
      ),
      setUpConfig: setUpConfigOfTranspileOptions("."),
    });
  });

  describe("cu$directoryOfThisFile", () => {
    const thisFilePath = fileOfImportMetaUrl(import.meta.url);
    const thisFilePathRelative = path.relative(process.cwd(), thisFilePath);
    testEvalFormOf({
      src: "cu$directoryOfThisFile",
      expected: path.normalize(path.dirname(thisFilePath)),
      setUpConfig: setUpConfigOfTranspileOptions(thisFilePathRelative),
    });

    testEvalFormOf({
      src: "cu$directoryOfThisFile",
      expected: process.cwd(),
      setUpConfig: setUpConfigOfTranspileOptions("."),
    });
  });

  describe("array", () => {
    testEvalFormOf({
      src: "(array.at [0, 1, 2] 0)",
      expected: 0,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(array.at [] 0)",
      expected: undefined,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(array.at [0, 1, 2] 1)",
      expected: 1,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(array.at [0] 1)",
      expected: undefined,
      setUpConfig,
    });

    testEvalFormOf({
      src: "(array.at [0] 1 2)",
      expected: new TranspileError(
        "`array.at` must receive exactly one expression!",
      ),
      setUpConfig,
    });

    testEvalFormOf({
      src: "(array.first [0, 1, 2])",
      expected: 0,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(array.first [])",
      expected: undefined,
      setUpConfig,
    });

    testEvalFormOf({
      src: "(array.last [0, 1, 2])",
      expected: 2,
      setUpConfig,
    });
    testEvalFormOf({
      src: "(array.last [])",
      expected: undefined,
      setUpConfig,
    });

    testEvalFormOf({
      src: "(array.map [2, 3, 5] (fn (x) (timesF x 2)))",
      expected: [4, 6, 10],
      setUpConfig,
    });
  });
});

describe("evalBlock", () => {
  describe("`annotate`", () => {
    testEvalBlockOf({
      src: '{ a: (annotate "This is a comment" 10) }',
      expected: { a: 10 },
      setUpConfig,
    });
    testEvalBlockOf({
      src: '(annotate "comment" { this: "is also", a: "comment" } (const f (fn () 9))) (f)',
      expected: 9,
      setUpConfig,
    });
  });

  describe("(const|let|assign id expression)", () => {
    testEvalBlockOf({
      src: "(const x (timesF 3 3))(plusF x 2)",
      expected: 11,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let y (dividedByF 3 2))(assign y (plusF y 2))(minusF y 6)",
      expected: -2.5,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const y 5)(const y 3)",
      expected: new TranspileError('Variable "y" is already defined!'),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const y 5)(assign y 3)",
      expected: new TranspileError(
        "`y` is not a name of a variable declared by `let` or a mutable property!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let y 6)(let y 7)",
      expected: new TranspileError('Variable "y" is already defined!'),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const y 5)(scope (const y 3) (timesF y 2))",
      expected: 6,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let y 6)(scope (let y 7) (dividedByF y 2))",
      expected: 3.5,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const y 5)(scope (const y 3) (plusF y 0)) (timesF y 2)",
      expected: 10,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let y 6)(scope (let y 7) (plusF y 0)) (dividedByF y 3)",
      expected: 2,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const y 3 2)",
      expected: new TranspileError(
        "The number of arguments to `const` must be 2!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let y 4 5)",
      expected: new TranspileError(
        "The number of arguments to `let` must be 2!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let y 8)(assign y 9 10))",
      expected: new TranspileError(
        "The number of arguments to `assign` must be 2!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const { x, y } { y: 3 x: 2 }) [x, y]",
      expected: [2, 3],
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let { x, y } { y: 3 x: 2 }) (assign x 4) [x, y]",
      expected: [4, 3],
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let { x, y } { y: 3 x: 2 }) (assign { x, y } { y: 4 x: 9 }) [x, y]",
      expected: [9, 4],
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let x 0) (let y 0) (const f (fn () (incrementF y) {x, y}))(const { x: x1 y: y1 } (f)) [x1, y1]",
      expected: [0, 1],
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(let x 0) (let y 0) (const f (fn () (incrementF y) {x, y})) (let x1) (let y1) (assign { x: x1 y: y1 } (f)) [x1, y1]",
      expected: [0, 1],
      setUpConfig,
    });
  });

  describe('{object: "literal"}', () => {
    testEvalBlockOf({
      src: '(const a "A") { a: 1 [a]: 2 }',
      expected: { a: 1, A: 2 },
      setUpConfig,
    });
    testEvalBlockOf({
      src: '(const a "A") { a b: 1 }',
      expected: { a: "A", b: 1 },
      setUpConfig,
    });
    testEvalBlockOf({
      src: "{ a b: 1 }",
      expected: new TranspileError(
        "No variable `a` is defined! NOTE: If you want to define `a` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpConfig,
    });
  });

  describe("(fn (a r g s) (f) (o) (r) (m) (s))", () => {
    testEvalBlockOf({
      src: "(const a 2.5) (const f (fn (x) (const b 3) (minusF (timesF a x) b))) (f 9)",
      expected: 19.5,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (return 904) x)) (f 9)",
      expected: 904,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (return 904))) (f 9)",
      expected: 904,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (when x x))) (f 9)",
      expected: undefined,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (when x (return x)))) (f 9)",
      expected: 9,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (incrementF x))) (f 9)",
      expected: undefined,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) (decrementF x))) (f 9)",
      expected: undefined,
      setUpConfig,
    });
  });

  describe("(procedure (a r g s) f o r m s)", () => {
    testEvalBlockOf({
      src: "(const p (procedure () (let x 6) (when false (return 9))))(p)",
      expected: undefined,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let n 0) (const p (procedure (x) (assign n (plusF 45 x)) (when true (return n)) -1)) (p 3)",
      expected: 48,
      setUpConfig,
    });
  });

  describe("(generatorFn (a r g s) f o r m s)", () => {
    testEvalBlockOf({
      src: "(const g (generatorFn () (yield 1) (yield 2) (yield 3))) (let r 0) (forEach n (g) (assign r (plusF r n))) r",
      expected: 6,
      setUpConfig,
    });
  });

  describe("(yield form)", () => {
    testEvalBlockOf({
      src: "(yield 1)",
      expected: new TranspileError(
        "`yield` must be used in a generator function!",
      ),
      setUpConfig,
    });
  });

  describe("(when bool f o r m s)", () => {
    testEvalBlockOf({
      src: "(let x -2) (when true (let y 905) (assign x (plusF x y))) x",
      expected: 903,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let x -2) (when false (let y 905) (assign x (plusF x y))) x",
      expected: -2,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(when)",
      expected: new TranspileError(
        "No expressions given to a `when` statement!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(when true)",
      expected: undefined,
      setUpConfig,
    });
  });

  describe("(while bool f o r m s)", () => {
    testEvalBlockOf({
      src: "(let x 8)(while (isLessThan x 100) (assign x (minusF x 1)) (assign x (timesF x 2))) x",
      expected: 194,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let x 8)(while (isLessThan x 100) (let x 7) (assign x (dividedByF x 2)) (break)) x",
      expected: 8,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(while)",
      expected: new TranspileError(
        "No conditional expression given to a `while` statement!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(while false)",
      expected: undefined,
      setUpConfig,
    });
  });

  describe("(for init bool final f o r m s)", () => {
    testEvalBlockOf({
      src: "(let y 0) (for (let x 8) (isLessThan x 100) (assign x (timesF x 2)) (assign x (minusF x 1)) (assign y x)) y",
      expected: 97,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let y 0) (for (let x 8) (isLessThan x 100) (incrementF x) (assign x (minusF x 0.5)) (assign y x) (continue) (decrementF x)) y",
      expected: 99,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(for)",
      expected: new TranspileError(
        "No initialization statement given to a `for` statement!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(for (let x 0))",
      expected: new TranspileError(
        "No conditional expression given to a `for` statement!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(for (let x 0) false)",
      expected: new TranspileError(
        "No final expression given to a `for` statement!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(for (let x 0) false (plusF x 1))",
      expected: undefined,
      setUpConfig,
    });
  });

  describe("(incrementF id)", () => {
    testEvalBlockOf({
      src: "(let x 0)(incrementF x) x",
      expected: 1,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let x 0)(incrementF x 2) x",
      expected: new TranspileError(
        "`incrementF` must receive only one symbol!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(const x 0)(incrementF x) x",
      expected: new TranspileError(
        "`x` is not a name of a variable declared by `let` or a mutable property!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(incrementF 0) 1",
      expected: new TranspileError(
        "The argument to `incrementF` must be a name of a variable!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(incrementF decrementF) 1",
      expected: new TranspileError(
        "`decrementF` is not a name of a variable declared by `let` or a mutable property!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(incrementF unknown) 1",
      expected: new TranspileError(
        "`unknown` is not a name of a variable declared by `let` or a mutable property!",
      ),
      setUpConfig,
    });
  });

  describe("(decrementF id)", () => {
    testEvalBlockOf({
      src: "(let x 0)(decrementF x) x",
      expected: -1,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let x 0)(decrementF x 2) x",
      expected: new TranspileError(
        "`decrementF` must receive only one symbol!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(const x 0)(decrementF x) x",
      expected: new TranspileError(
        "`x` is not a name of a variable declared by `let` or a mutable property!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(decrementF 0) 1",
      expected: new TranspileError(
        "The argument to `decrementF` must be a name of a variable!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(decrementF incrementF) 1",
      expected: new TranspileError(
        "`incrementF` is not a name of a variable declared by `let` or a mutable property!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(decrementF unknown) 1",
      expected: new TranspileError(
        "`unknown` is not a name of a variable declared by `let` or a mutable property!",
      ),
      setUpConfig,
    });
  });

  describe("(forEach id iterable s t a t e m e n t s)", () => {
    testEvalBlockOf({
      src: "(let x 0)(forEach v [1 2 3] (assign x (plusF x v))) x",
      expected: 6,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let x 0)(forEach { x: v1, y: v2 } [{ x: 1, y: 1 } { x: 2, y: 2 } { x: 3, y: 3 }] (assign x (plusF (plusF x v1) v2))) x",
      expected: 12,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let x 0)(forEach { v1, v2 } [{ v1: 1, v2: 1 } { v1: 2, v2: 2 } { v1: 3, v2: 3 }] (assign x (plusF (plusF x v1) v2))) x",
      expected: 12,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(let x 0)(let v 0)(forEach x [7 8 9] (assign v (plusF x v))) v",
      expected: 24,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(forEach v [1 2 3])",
      expected: undefined,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(forEach v)",
      expected: new TranspileError(
        "No iterable expression given to a `forEach` statement!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(forEach)",
      expected: new TranspileError(
        "No variable name given to a `forEach` statement!",
      ),
      setUpConfig,
    });

    describe("inside a `scope`", () => {
      testEvalBlockOf({
        src: "(let v 0)(scope (let x 2) (forEach v [1 2 3] (assign x (plusF x v))) x)",
        expected: 8,
        setUpConfig,
      });
      testEvalBlockOf({
        src: "(let x 0)(scope (forEach v [1 2 3] (assign x (plusF x v)))) x",
        expected: 6,
        setUpConfig,
      });
      testEvalBlockOf({
        src: "(let x 0)(scope (forEach { x: v1, y: v2 } [{ x: 1, y: 1 } { x: 2, y: 2 } { x: 3, y: 3 }] (assign x (plusF (plusF x v1) v2)))) x",
        expected: 12,
        setUpConfig,
      });
      testEvalBlockOf({
        src: "(let x 0)(scope (forEach { v1, v2 } [{ v1: 1, v2: 1 } { v1: 2, v2: 2 } { v1: 3, v2: 3 }] (assign x (plusF (plusF x v1) v2)))) x",
        expected: 12,
        setUpConfig,
      });
    });
  });

  describe("recursive calls", () => {
    testEvalBlockOf({
      src: "(const f (fn (x) (return 1) (f x)))",
      expected: new TranspileError(
        "No variable `f` is defined! NOTE: If you want to define `f` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(const f (fn (x) (return 1) (g x))) (const g (fn (x) (return 2) (f x)))",
      expected: new TranspileError(
        "No variable `g` is defined! NOTE: If you want to define `g` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(recursive (const f (fn (x) (return 1) (f x)))) (f 0)",
      expected: 1,
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(recursive (const f (fn (x) (return 1) (g x))) (const g (fn (x) (return 2) (f x)))) (g 0)",
      expected: 2,
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const f (fn (x) 1))(scope (const f (fn (x) (return 2) (f x))) (f 0))",
      expected: new TranspileError(
        "No variable `f` is defined! NOTE: If you want to define `f` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(const g (fn () 1))(scope (const f (fn (x) (return 2) (g))) (const g (fn () (return 3) (f 1))) (f 0))",
      expected: new TranspileError(
        "No variable `g` is defined! NOTE: If you want to define `g` recursively, wrap the declaration(s) with `recursive`.",
      ),
      setUpConfig,
    });
  });

  describe("(recursive d e c l a r a t i o n s)", () => {
    testEvalBlockOf({
      src: "(recursive (let x 1))",
      expected: new TranspileError(
        "All declarations in `recursive` must be `const`!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(recursive (const))",
      expected: new TranspileError("undefined is not a symbol!"),
      setUpConfig,
    });
    testEvalBlockOf({
      src: '(recursive "")',
      expected: new TranspileError(
        "All arguments in `recursive` must be `const` declarations!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(recursive)",
      expected: new TranspileError(
        "No `const` statements given to `recursive`!",
      ),
      setUpConfig,
    });
  });

  describe("handling exceptions", () => {
    testEvalBlockOf({
      src: "(try)",
      expected: new TranspileError(
        "Nither `catch` nor `finally` given to a `try` statement!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(try (const x 1))",
      expected: new TranspileError(
        "Nither `catch` nor `finally` given to a `try` statement!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(try (const x 1) catch)",
      expected: new TranspileError(
        "No variable name of the caught exception given to a `catch` clause!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(try (const x 1) catch finally (const y 2))",
      expected: new TranspileError(
        "No variable name of the caught exception given to a `catch` clause!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(try (const x 1) catch (const y 2))",
      expected: new TranspileError(
        "No variable name of the caught exception given to a `catch` clause!",
      ),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(try (const x 1) catch (const y 2) finally (const y 2))",
      expected: new TranspileError(
        "No variable name of the caught exception given to a `catch` clause!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(try (const x 1) catch e (const y 2) catch e1 (const z 9) finally (const y 2))",
      expected: new TranspileError("`catch` clause specified more than once"),
      setUpConfig,
    });
    testEvalBlockOf({
      src: "(try (const x 1) catch e (const y 2) finally (const z 9) finally (const y 2))",
      expected: new TranspileError("`finally` clause specified more than once"),
      setUpConfig,
    });

    testEvalBlockOf({
      src: "(try (const x 1) finally (const z 3) catch e (const y 2))",
      expected: new TranspileError(
        "A `finally` clause must be followed by a `catch` clause!",
      ),
      setUpConfig,
    });

    testEvalBlockOf({
      src: '(let x 1) (let y 10) (try (try (throw "thrown") finally (assign x 2)) catch _ (assign y 20)) [x, y]',
      expected: [2, 20],
      setUpConfig,
    });
  });

  describe("array", () => {
    testEvalBlockOf({
      src: "(const a [])(array.push a 2)(array.push a 3)(array.push a 5) a",
      expected: [2, 3, 5],
      setUpConfig,
    });
  });
});
