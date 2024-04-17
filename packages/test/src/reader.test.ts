import { describe, expect, test } from "vitest";

import { readStr } from "@custard-lang/processor/dist/reader.js";
import { ParseError } from "@custard-lang/processor/dist/grammar.js";
import { locatedCuSymbol } from "@custard-lang/processor/dist/internal/types.js";

describe("readStr", () => {
  const path = "test";
  const inputOf = (contents: string) => ({ path, contents });
  const location = (l: number, c: number) => ({ f: path, l, c });

  describe("Integer32", () => {
    test("`123` -> `123`", () => {
      expect(readStr(inputOf("123"))).toEqual({ t: "Integer32", v: 123, ...location(1, 1) });
    });
    test("`45 ` -> `45`", () => {
      expect(readStr(inputOf("45 "))).toEqual({ t: "Integer32", v: 45, ...location(1, 1) });
    });
    test("` \n 6 \n` -> `6`", () => {
      expect(readStr(inputOf(" \n 6 \n"))).toEqual({ t: "Integer32", v: 6, ...location(2, 2) });
    });
  });

  describe("Float64", () => {
    test("` 789.1  ` -> `789.1`", () => {
      expect(readStr(inputOf(" 789.1  "))).toEqual({ t: "Float64", v: 789.1, ...location(1, 2) });
    });
    test("`-800.19` -> `-800.19`", () => {
      expect(readStr(inputOf("-800.19"))).toEqual({ t: "Float64", v: -800.19, ...location(1, 1) });
    });
  });

  describe("String", () => {
    test('`   "aaa"` -> `"aaa"`', () => {
      expect(readStr(inputOf('   "aaa"'))).toEqual({ t: "String", v: "aaa", ...location(1, 4) });
    });
    test('`   \n"\\\\aaa"` -> `"\\\\aaa"`', () => {
      expect(readStr(inputOf('   \n"\\\\aaa"'))).toEqual({ t: "String", v: "\\aaa", ...location(2, 1) });
    });
  });

  describe("Symbol", () => {
    test("`abc` -> `abc`", () => {
      expect(readStr(inputOf("abc"))).toEqual({ t: "Symbol", v: "abc", ...location(1, 1) });
    });
    test("` \n  \n  abc ` -> `abc`", () => {
      expect(readStr(inputOf(" \n  \n  abc "))).toEqual({ t: "Symbol", v: "abc", ...location(3, 3) });
    });
  });

  describe("PropertyAccess", () => {
    test("`a.b.c` -> `a.b.c`", () => {
      expect(readStr(inputOf("a.b.c"))).toEqual({
        t: "PropertyAccess",
        v: ["a", "b", "c"],
        ...location(1, 1),
      });
    });
    test("` aa.bc ` -> `aa.bc`", () => {
      expect(readStr(inputOf(" aa.bc "))).toEqual({
        t: "PropertyAccess",
        v: ["aa", "bc"],
        ...location(1, 2),
      });
    });
  });

  describe("reserved symbols", () => {
    test("`true` -> `true`", () => {
      expect(readStr(inputOf("true"))).toEqual({ t: "ReservedSymbol", v: true, ...location(1, 1) });
    });
    test("`   false ` -> `false`", () => {
      expect(readStr(inputOf("   false "))).toEqual({ t: "ReservedSymbol", v: false, ...location(1, 4) });
    });
    test("`\n\nnone ` -> `none`", () => {
      expect(readStr(inputOf("\n\nnone "))).toEqual({ t: "ReservedSymbol", v: null, ...location(3, 1) });
    });
  });

  describe("List", () => {
    test("`(123 456)` -> `(123 456)`", () => {
      expect(readStr(inputOf("(123 456)"))).toEqual({
        t: "List",
        v: [
          { t: "Integer32", v: 123, ...location(1, 2) },
          { t: "Integer32", v: 456, ...location(1, 6) },
        ],
        ...location(1, 1),
      });
    });
    test("`( 123 456\n 789 )` -> `(123 456\n 789)`", () => {
      expect(readStr(inputOf("( 123 456\n 789 )"))).toEqual({
        t: "List",
        v: [
          { t: "Integer32", v: 123, ...location(1, 3) },
          { t: "Integer32", v: 456, ...location(1, 7) },
          { t: "Integer32", v: 789, ...location(2, 2) },
        ],
        ...location(1, 1),
      });
    });
    test('`( pl.us 2 (m 3 4) none  "foo" )` -> `(pl.us 2 (m 3 4) none "foo")`', () => {
      expect(readStr(inputOf('( pl.us 2 (m 3 4) none  "foo" )'))).toEqual({
        t: "List",
        v: [
          { t: "PropertyAccess", v: ["pl", "us"], ...location(1, 3) },
          { t: "Integer32", v: 2, ...location(1, 9) },
          {
            t: "List",
            v: 
            [
              { t: "Symbol", v: "m", ...location(1, 12) },
              { t: "Integer32", v: 3, ...location(1, 14) },
              { t: "Integer32", v: 4, ...location(1, 16) },
            ],
            ...location(1, 11),
          },
          { t: "ReservedSymbol", v: null, ...location(1, 19) },
          { t: "String", v: "foo", ...location(1, 25) },
        ],
        ...location(1, 1),
      });
    });
  });

  describe("LiteralArray", () => {
    test("`[123 456]` -> `[123 456]`", () => {
      expect(readStr(inputOf("[123 456]"))).toEqual({
        t: "Array",
        v: [
          { t: "Integer32", v: 123, ...location(1, 2) },
          { t: "Integer32", v: 456, ...location(1, 6) },
        ],
        ...location(1, 1),
      });
    });
    test("`[ 123 456 789 ]` -> `[123 456 789]`", () => {
      expect(readStr(inputOf("[ 123 456 789 ]"))).toEqual({
        t: "Array",
        v: [
          { t: "Integer32", v: 123, ...location(1, 3) },
          { t: "Integer32", v: 456, ...location(1, 7) },
          { t: "Integer32", v: 789, ...location(1, 11) },
        ],
        ...location(1, 1),
      });
    });
    test('`[ pl.us 2 (m\n 3 4) none  "foo" ]` -> `[pl.us 2 (m 3 4) none "foo"]`', () => {
      expect(readStr(inputOf('[ pl.us 2 (m\n 3 4) none  "foo" ]'))).toEqual({
        t: "Array",
        v: [
          { t: "PropertyAccess", v: ["pl", "us"], ...location(1, 3) },
          { t: "Integer32", v: 2, ...location(1, 9) },
          {
            t: "List",
            v: [
              { t: "Symbol", v: "m", ...location(1, 12) },
              { t: "Integer32", v: 3, ...location(2, 2) },
              { t: "Integer32", v: 4, ...location(2, 4) },
            ],
            ...location(1, 11),
          },
          { t: "ReservedSymbol", v: null, ...location(2, 7) },
          { t: "String", v: "foo", ...location(2, 13) },
        ],
        ...location(1, 1),
      });
    });
  });

  describe("LiteralObject", () => {
    test('`{ a: 1.0 bc: "def" }`', () => {
      expect(readStr(inputOf('{ a:\n1.0\nbc: "def" }'))).toEqual({
        t: "Object",
        v: [
          [
            locatedCuSymbol("a", location(1, 3)),
            { t: "Float64", v: 1.0, ...location(2, 1) },
          ],
          [
            locatedCuSymbol("bc", location(3, 1)),
            { t: "String", v: "def", ...location(3, 5) },
          ],
        ],
        ...location(1, 1),
      });
    });

    test('`{ a: { aa: ( 1.1 2.1 3.3 ) ab: 3.0 } bc: "def" }`', () => {
      expect(
        readStr(inputOf('{ a: {\naa: ( 1.1 2.1 3.3\n) ab: 3.0 }\nbc: "def" }')),
      ).toEqual({
        t: "Object",
        v: [
          [
            locatedCuSymbol("a", location(1, 3)),
            {
              t: "Object",
              v: [
                [
                  locatedCuSymbol("aa", location(2, 1)),
                  {
                    t: "List",
                    v: [
                      { t: "Float64", v: 1.1, ...location(2, 7) },
                      { t: "Float64", v: 2.1, ...location(2, 11) },
                      { t: "Float64", v: 3.3, ...location(2, 15) },
                    ],
                    ...location(2, 5),
                  },
                ],
                [
                  locatedCuSymbol("ab", location(3, 3)),
                  { t: "Float64", v: 3.0, ...location(3, 7) },
                ],
              ],
              ...location(1, 6),
            },
          ],
          [
            locatedCuSymbol("bc", location(4, 1)),
            { t: "String", v: "def", ...location(4, 5) },
          ],
        ],
        ...location(1, 1),
      });
    });
  });

  describe("ParseError", () => {
    test("when the input string contains unmatched parentheses", () => {
      expect(readStr(inputOf("(p 45"))).toEqual(
        new ParseError("Expected form or close paren, but got end of input"),
      );
    });
    test("when the input string contains an extra closing parenthesis", () => {
      expect(readStr(inputOf("(p 0 9))"))).toEqual(
        new ParseError('Unexpected token left!: close paren: ")"'),
      );
    });
    test("when the input string contains unmatched double quotes", () => {
      expect(readStr(inputOf('(p "hello)'))).toEqual(
        new ParseError('Unterminated string literal: "hello) at line 1, column 4'),
      );
      expect(readStr(inputOf('(p  "hola\\")'))).toEqual(
        new ParseError('Unterminated string literal: "hola\\") at line 1, column 5'),
      );
      expect(readStr(inputOf('(p\n "'))).toEqual(
        new ParseError('Unterminated string literal: " at line 2, column 2'),
      );
    });

    test("when the input string contains an unexpected token", () => {
      // FIXME: This error message is not exact: Should be "Expected form or close ...".
      expect(readStr(inputOf("{ a: b, c: d }"))).toEqual(
        new ParseError('Expected form, but got unknown: ",", at line 1, column 7'),
      );
      expect(readStr(inputOf("[a, b]"))).toEqual(
        new ParseError('Expected form, but got unknown: ",", at line 1, column 3'),
      );
      expect(readStr(inputOf("[a: b]"))).toEqual(
        new ParseError('Expected form, but got colon: ":", at line 1, column 3'),
      );
    });
  });
});
