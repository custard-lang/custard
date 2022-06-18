import { readStr } from "./reader";
import { describe, expect, test } from "vitest";

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

  describe("reserved symbols", () => {
    test("`True` -> `True`", () => {
      expect(readStr("True")).toEqual(true);
    });
    test("`False ` -> `False`", () => {
      expect(readStr("False ")).toEqual(false);
    });
    test("` None ` -> `None`", () => {
      expect(readStr("None ")).toEqual(undefined);
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
    test('`( + 2 (* 3 4) None  "foo" )` -> `(+ 2 (* 3 4) None "foo")`', () => {
      expect(readStr('( + 2 (* 3 4) None  "foo" )')).toEqual([
        { t: "Symbol", v: "+" },
        { t: "Integer32", v: 2 },
        [
          { t: "Symbol", v: "*" },
          { t: "Integer32", v: 3 },
          { t: "Integer32", v: 4 },
        ],
        undefined,
        "foo",
      ]);
    });
  });
});
