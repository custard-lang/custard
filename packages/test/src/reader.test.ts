import { describe, expect, test } from "vitest";

import { readResumably, readStr } from "@custard-lang/processor/dist/reader.js";
import {
  isParseError,
  ParseErrorSkipping,
  ParseErrorWantingMore,
} from "@custard-lang/processor/dist/grammar.js";
import {
  locatedFloat64,
  locatedInteger32,
  locatedCuString,
  locatedCuSymbol,
  locatedPropertyAccess,
  locatedReservedSymbol,
  locatedCuArray,
  locatedCuObject,
  locatedList,
  type Location,
  type Form,
  locatedUnquote,
  locatedSplice,
} from "@custard-lang/processor/dist/internal/types.js";
import { keyValue } from "@custard-lang/processor/dist/types.js";

const path = "test";

const inputOf = (contents: string) => ({ path, contents }) as const;
const location = (l: number, c: number) => ({ f: path, l, c }) as const;

describe("readStr", () => {
  describe("Integer32", () => {
    test("`123` -> `123`", () => {
      expect(readStr(inputOf("123"))).toEqual(
        locatedInteger32(123, location(1, 1)),
      );
    });
    test("`45 ` -> `45`", () => {
      expect(readStr(inputOf("45 "))).toEqual(
        locatedInteger32(45, location(1, 1)),
      );
    });
    test("` \n 6 \n` -> `6`", () => {
      expect(readStr(inputOf(" \n 6 \n"))).toEqual(
        locatedInteger32(6, location(2, 2)),
      );
    });
  });

  describe("Float64", () => {
    test("` 789.1  ` -> `789.1`", () => {
      expect(readStr(inputOf(" 789.1  "))).toEqual(
        locatedFloat64(789.1, location(1, 2)),
      );
    });
    test("`-800.19` -> `-800.19`", () => {
      expect(readStr(inputOf("-800.19"))).toEqual(
        locatedFloat64(-800.19, location(1, 1)),
      );
    });
  });

  describe("String", () => {
    test('`   "aaa"` -> `"aaa"`', () => {
      expect(readStr(inputOf('   "aaa"'))).toEqual(
        locatedCuString("aaa", location(1, 4)),
      );
    });
    test('`   \n"\\\\aaa"` -> `"\\\\aaa"`', () => {
      expect(readStr(inputOf('   \n"\\\\aaa"'))).toEqual(
        locatedCuString("\\aaa", location(2, 1)),
      );
    });
  });

  describe("Symbol", () => {
    test("`abc` -> `abc`", () => {
      expect(readStr(inputOf("abc"))).toEqual(
        locatedCuSymbol("abc", location(1, 1)),
      );
    });
    test("` \n  \n  abc ` -> `abc`", () => {
      expect(readStr(inputOf(" \n  \n  abc "))).toEqual(
        locatedCuSymbol("abc", location(3, 3)),
      );
    });
  });

  describe("PropertyAccess", () => {
    test("`a.b.c` -> `a.b.c`", () => {
      expect(readStr(inputOf("a.b.c"))).toEqual(
        locatedPropertyAccess(["a", "b", "c"], location(1, 1)),
      );
    });
    test("` aa.bc ` -> `aa.bc`", () => {
      expect(readStr(inputOf(" aa.bc "))).toEqual(
        locatedPropertyAccess(["aa", "bc"], location(1, 2)),
      );
    });
  });

  describe("reserved symbols", () => {
    test("`true` -> `true`", () => {
      expect(readStr(inputOf("true"))).toEqual(
        locatedReservedSymbol(true, location(1, 1)),
      );
    });
    test("`   false ` -> `false`", () => {
      expect(readStr(inputOf("   false "))).toEqual(
        locatedReservedSymbol(false, location(1, 4)),
      );
    });
    test("`\n\nnone ` -> `none`", () => {
      expect(readStr(inputOf("\n\nnone "))).toEqual(
        locatedReservedSymbol(null, location(3, 1)),
      );
    });
  });

  describe("List", () => {
    test("`(123 456)` -> `(123 456)`", () => {
      expect(readStr(inputOf("(123 456)"))).toEqual(
        locatedList(
          [
            locatedInteger32(123, location(1, 2)),
            locatedInteger32(456, location(1, 6)),
          ],
          location(1, 1),
        ),
      );
    });
    test("`( 123 456\n 789 )` -> `(123 456\n 789)`", () => {
      expect(readStr(inputOf("( 123 456\n 789 )"))).toEqual(
        locatedList(
          [
            locatedInteger32(123, location(1, 3)),
            locatedInteger32(456, location(1, 7)),
            locatedInteger32(789, location(2, 2)),
          ],
          location(1, 1),
        ),
      );
    });
    test('`( pl.us 2 (m 3 4) none  "foo" )` -> `(pl.us 2 (m 3 4) none "foo")`', () => {
      expect(readStr(inputOf('( pl.us 2 (m 3 4) none  "foo" )'))).toEqual(
        locatedList(
          [
            locatedPropertyAccess(["pl", "us"], location(1, 3)),
            locatedInteger32(2, location(1, 9)),
            locatedList(
              [
                locatedCuSymbol("m", location(1, 12)),
                locatedInteger32(3, location(1, 14)),
                locatedInteger32(4, location(1, 16)),
              ],
              location(1, 11),
            ),
            locatedReservedSymbol(null, location(1, 19)),
            locatedCuString("foo", location(1, 25)),
          ],
          location(1, 1),
        ),
      );
    });
  });

  describe("LiteralArray", () => {
    test("`[123 456]` -> `[123 456]`", () => {
      expect(readStr(inputOf("[123 456]"))).toEqual(
        locatedCuArray(
          [
            locatedInteger32(123, location(1, 2)),
            locatedInteger32(456, location(1, 6)),
          ],
          location(1, 1),
        ),
      );
    });
    test("`[ 123 456 789 ]` -> `[123 456 789]`", () => {
      expect(readStr(inputOf("[ 123 456 789 ]"))).toEqual(
        locatedCuArray(
          [
            locatedInteger32(123, location(1, 3)),
            locatedInteger32(456, location(1, 7)),
            locatedInteger32(789, location(1, 11)),
          ],
          location(1, 1),
        ),
      );
    });
    test('`[ pl.us 2 (m\n 3 4) none  "foo" ]` -> `[pl.us 2 (m 3 4) none "foo"]`', () => {
      expect(readStr(inputOf('[ pl.us 2 (m\n 3 4) none  "foo" ]'))).toEqual(
        locatedCuArray(
          [
            locatedPropertyAccess(["pl", "us"], location(1, 3)),
            locatedInteger32(2, location(1, 9)),
            locatedList(
              [
                locatedCuSymbol("m", location(1, 12)),
                locatedInteger32(3, location(2, 2)),
                locatedInteger32(4, location(2, 4)),
              ],
              location(1, 11),
            ),
            locatedReservedSymbol(null, location(2, 7)),
            locatedCuString("foo", location(2, 13)),
          ],
          location(1, 1),
        ),
      );
    });
  });

  describe("LiteralObject", () => {
    test('`{ a: 1.0 bc: "def" }`', () => {
      expect(readStr(inputOf('{ a:\n1.0\nbc: "def" }'))).toEqual(
        locatedCuObject(
          [
            keyValue<Form<Location>, Form<Location>, Form<Location>, Location>(
              locatedCuSymbol("a", location(1, 3)),
              locatedFloat64(1.0, location(2, 1)),
            ),
            keyValue<Form<Location>, Form<Location>, Form<Location>, Location>(
              locatedCuSymbol("bc", location(3, 1)),
              locatedCuString("def", location(3, 5)),
            ),
          ],
          location(1, 1),
        ),
      );
    });

    test('`{ a: { aa: ( 1.1 2.1 3.3 ) ab: 3.0 } bc: "def" }`', () => {
      expect(
        readStr(inputOf('{ a: {\naa: ( 1.1 2.1 3.3\n) ab: 3.0 }\nbc: "def" }')),
      ).toEqual(
        locatedCuObject(
          [
            keyValue<Form<Location>, Form<Location>, Form<Location>, Location>(
              locatedCuSymbol("a", location(1, 3)),
              locatedCuObject(
                [
                  keyValue<
                    Form<Location>,
                    Form<Location>,
                    Form<Location>,
                    Location
                  >(
                    locatedCuSymbol("aa", location(2, 1)),
                    locatedList(
                      [
                        locatedFloat64(1.1, location(2, 7)),
                        locatedFloat64(2.1, location(2, 11)),
                        locatedFloat64(3.3, location(2, 15)),
                      ],
                      location(2, 5),
                    ),
                  ),
                  keyValue<
                    Form<Location>,
                    Form<Location>,
                    Form<Location>,
                    Location
                  >(
                    locatedCuSymbol("ab", location(3, 3)),
                    locatedFloat64(3.0, location(3, 7)),
                  ),
                ],
                location(1, 6),
              ),
            ),
            keyValue<Form<Location>, Form<Location>, Form<Location>, Location>(
              locatedCuSymbol("bc", location(4, 1)),
              locatedCuString("def", location(4, 5)),
            ),
          ],
          location(1, 1),
        ),
      );
    });
  });

  describe("Unquote", () => {
    test("`$a` -> `$a`", () => {
      expect(readStr(inputOf("$a"))).toEqual(
        locatedUnquote(locatedCuSymbol("a", location(1, 2)), location(1, 1)),
      );
    });
    test("`$(1 2 3)` -> `$(1 2 3)`", () => {
      expect(readStr(inputOf("$(1 2 3)"))).toEqual(
        locatedUnquote(
          locatedList(
            [
              locatedInteger32(1, location(1, 3)),
              locatedInteger32(2, location(1, 5)),
              locatedInteger32(3, location(1, 7)),
            ],
            location(1, 2),
          ),
          location(1, 1),
        ),
      );
    });
  });

  describe("Splice (and Unquote)", () => {
    test("`...$a` -> `...$a`", () => {
      expect(readStr(inputOf("...$a"))).toEqual(
        locatedSplice(
          locatedUnquote(locatedCuSymbol("a", location(1, 5)), location(1, 4)),
          location(1, 1),
        ),
      );
    });

    test("`...$(1 2 3)` -> `...$(1 2 3)`", () => {
      expect(readStr(inputOf("...$(1 2 3)"))).toEqual(
        locatedSplice(
          locatedUnquote(
            locatedList(
              [
                locatedInteger32(1, location(1, 6)),
                locatedInteger32(2, location(1, 8)),
                locatedInteger32(3, location(1, 10)),
              ],
              location(1, 5),
            ),
            location(1, 4),
          ),
          location(1, 1),
        ),
      );
    });
  });

  describe("ParseError", () => {
    test("when the input string contains an extra closing parenthesis", () => {
      const expected = readStr(inputOf("(p 0 9))"));
      expect(expected).toBeInstanceOf(ParseErrorSkipping);
      expect((expected as ParseErrorSkipping<unknown>).message).toEqual(
        'Unexpected token left!: ")" at line 1, column 8 of test',
      );
    });

    test("when the input string contains unmatched parentheses", () => {
      const expected = readStr(inputOf("(p 45"));
      expect(expected).toBeInstanceOf(ParseErrorWantingMore);
      expect((expected as ParseErrorWantingMore<unknown>).message).toEqual(
        "Expected form or close paren, but got end of input, at line 1, column 6 of test",
      );
    });

    test("when the input string contains unmatched double quotes", () => {
      const expected1 = readStr(inputOf('(p "hello)'));
      expect(expected1).toBeInstanceOf(ParseErrorWantingMore);
      expect((expected1 as ParseErrorWantingMore<unknown>).message).toEqual(
        'Unterminated string literal: "hello) at line 1, column 4',
      );

      const expected2 = readStr(inputOf('(p  "hola\\")'));
      expect(expected2).toBeInstanceOf(ParseErrorWantingMore);
      expect((expected2 as ParseErrorWantingMore<unknown>).message).toEqual(
        'Unterminated string literal: "hola\\") at line 1, column 5',
      );

      const expected3 = readStr(inputOf('(p\n "'));
      expect(expected3).toBeInstanceOf(ParseErrorWantingMore);
      expect((expected3 as ParseErrorWantingMore<unknown>).message).toEqual(
        'Unterminated string literal: " at line 2, column 2',
      );
    });
  });
});

describe("readResumably", () => {
  test("can resume parsing complex structures with all syntax elements", () => {
    // Most complex test case using all the syntax rules:
    // number, string, array, list, object, unquote, splice, symbol, property access
    // prettier-ignore
    const complexTokens = [
      "{",
      // string key with property access value
      '"', "k", "e", "y", "1", '"', ":", " ", "obj.prop", ".", "value", ",", " ",
      // computed key with array value containing numbers and strings
      "[", "(", "plusF", " ", "1", " ", "2", ")", "]", ":", " ", "[", "123", ",", " ", '"', "t", "e", "s", "t", '"', "]", ",", " ",
      // symbol key with list value containing unquote and splice
      "data", ":", " ", "(", "list", " ", "$", "var", " ", "...", "$", "items", ")",
      " ", "}"
    ];

    const fullInput = complexTokens.join("");
    const expected = readStr(inputOf(fullInput));

    if (isParseError(expected)) {
      throw expected;
    }

    // Test resumability at every token boundary
    for (let i = 1; i < complexTokens.length; i++) {
      const partialInput = complexTokens.slice(0, i).join("");
      const remainingInput = complexTokens.slice(i).join("");

      const partialResult = readResumably(inputOf(partialInput));

      // Should get ParseErrorWantingMore for incomplete input
      expect(partialResult).toBeInstanceOf(ParseErrorWantingMore);
      const resumedResult = (
        partialResult as ParseErrorWantingMore<Form<Location>>
      ).resume(remainingInput);

      // Should match the expected result
      expect(resumedResult).toEqual(expected);
    }
  });

  test("handles deeply nested structure with string character-level splitting", () => {
    // Complex nested structure with string that needs character-level testing
    // prettier-ignore
    const nestedTokens = [
      "[",
      // Object with string value split at character level
      "{", " ", "name", ":", " ", '"', "h", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d", '"', " ", "}",
      ",", " ",
      // Array with property access and unquote
      "[", "obj.method", ",", " ", "$", "variable", "]",
      ",", " ",
      // Function call with splice
      "(", "concat", " ", "...", "$", "args", ")",
      "]"
    ];

    const fullInput = nestedTokens.join("");
    const expected = readStr(inputOf(fullInput));

    if (isParseError(expected)) {
      throw expected;
    }

    // Test at every position to ensure string characters can be resumed
    for (let i = 1; i < nestedTokens.length; i++) {
      const partialInput = nestedTokens.slice(0, i).join("");
      const remainingInput = nestedTokens.slice(i).join("");

      const partialResult = readResumably(inputOf(partialInput));
      expect(partialResult).toBeInstanceOf(ParseErrorWantingMore);

      const resumedResult = (
        partialResult as ParseErrorWantingMore<Form<Location>>
      ).resume(remainingInput);
      expect(resumedResult).toEqual(expected);
    }
  });
});
