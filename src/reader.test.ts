import { readStr } from "./reader";
import { describe, expect, test } from "vitest";
import { ParseError } from "./grammar";
import { cuSymbol } from "./types";

describe("readStr", () => {
  describe("Integer32", () => {
    test("`123` -> `123`", () => {
      expect(readStr("123")).toEqual({ t: "Integer32", v: 123 });
    });
    test("`123 ` -> `123`", () => {
      expect(readStr("123 ")).toEqual({ t: "Integer32", v: 123 });
    });
  });

  describe("Float64", () => {
    test("` 789.1  ` -> `789.1`", () => {
      expect(readStr(" 789.1  ")).toEqual(789.1);
    });
    test("`-800.19` -> `-800.19`", () => {
      expect(readStr("-800.19")).toEqual(-800.19);
    });
  });

  describe("String", () => {
    test('`   "aaa"` -> `"aaa"`', () => {
      expect(readStr('   "aaa"')).toEqual("aaa");
    });
    test('`   "\\\\aaa"` -> `"\\\\aaa"`', () => {
      expect(readStr('   "\\\\aaa"')).toEqual("\\aaa");
    });
  });

  describe("Symbol", () => {
    test("`abc` -> `abc`", () => {
      expect(readStr("abc")).toEqual({ t: "Symbol", v: "abc" });
    });
    test("`abc ` -> `abc`", () => {
      expect(readStr("abc ")).toEqual({ t: "Symbol", v: "abc" });
    });
  });

  describe("PropertyAccess", () => {
    test("`a.b.c` -> `a.b.c`", () => {
      expect(readStr("a.b.c")).toEqual({
        t: "PropertyAccess",
        v: ["a", "b", "c"],
      });
    });
    test("`aa.bc ` -> `aa.bc`", () => {
      expect(readStr("aa.bc ")).toEqual({
        t: "PropertyAccess",
        v: ["aa", "bc"],
      });
    });
  });

  describe("reserved symbols", () => {
    test("`true` -> `true`", () => {
      expect(readStr("true")).toEqual(true);
    });
    test("`false ` -> `false`", () => {
      expect(readStr("false ")).toEqual(false);
    });
    test("` undefined ` -> `undefined`", () => {
      expect(readStr("undefined ")).toEqual(undefined);
    });
  });

  describe("Array", () => {
    test("`(123 456)` -> `(123 456)`", () => {
      expect(readStr("(123 456)")).toEqual([
        { t: "Integer32", v: 123 },
        { t: "Integer32", v: 456 },
      ]);
    });
    test("`( 123 456 789 )` -> `(123 456 789)`", () => {
      expect(readStr("(123 456 789)")).toEqual([
        { t: "Integer32", v: 123 },
        { t: "Integer32", v: 456 },
        { t: "Integer32", v: 789 },
      ]);
    });
    test('`( pl.us 2 (m 3 4) undefined  "foo" )` -> `(pl.us 2 (m 3 4) undefined "foo")`', () => {
      expect(readStr('( pl.us 2 (m 3 4) undefined  "foo" )')).toEqual([
        { t: "PropertyAccess", v: ["pl", "us"] },
        { t: "Integer32", v: 2 },
        [
          { t: "Symbol", v: "m" },
          { t: "Integer32", v: 3 },
          { t: "Integer32", v: 4 },
        ],
        undefined,
        "foo",
      ]);
    });
  });

  describe("Object", () => {
    test('`{ a: 1.0 bc: "def" }`', () => {
      expect(readStr('{ a: 1.0 bc: "def" }')).toEqual({
        t: "KeyValues",
        v: [
          [cuSymbol("a"), 1.0],
          [cuSymbol("bc"), "def"],
        ],
      });
    });

    test('`{ a: { aa: ( 1.1 2.1 3.3 ) ab: 3.0 } bc: "def" }`', () => {
      expect(
        readStr('{ a: { aa: ( 1.1 2.1 3.3 ) ab: 3.0 } bc: "def" }'),
      ).toEqual({
        t: "KeyValues",
        v: [
          [
            cuSymbol("a"),
            {
              t: "KeyValues",
              v: [
                [cuSymbol("aa"), [1.1, 2.1, 3.3]],
                [cuSymbol("ab"), 3.0],
              ],
            },
          ],
          [cuSymbol("bc"), "def"],
        ],
      });
    });
  });

  describe("ParseError", () => {
    test("when the input string contains unmatched parentheses", () => {
      expect(readStr("(p 45")).toEqual(
        new ParseError("Unexpected end of input!"),
      );
    });
    test("when the input string contains an extra closing parenthesis", () => {
      expect(readStr("(p 0 9))")).toEqual(
        new ParseError('Unexpected token left!: ")"'),
      );
    });
    test("when the input string contains unmatched double quotes", () => {
      expect(readStr('(p "hello)')).toEqual(
        new ParseError("Unexpected end of input!"),
      );
    });
  });
});
