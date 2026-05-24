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
  type ReaderInput,
  readerInput,
} from "@custard-lang/processor/dist/internal/types.js";
import {
  computedKey,
  cuArray,
  cuObject,
  cuString,
  cuSymbol,
  CuSymbol,
  float64,
  integer32,
  isComputedKey,
  isCuArray,
  isCuObject,
  isCuString,
  isCuSymbol,
  isFloat64,
  isInteger32,
  isKeyValue,
  isList,
  isPropertyAccess,
  isReservedSymbol,
  isSplice,
  isUnquote,
  keyValue,
  KeyValueKey,
  list,
  propertyAccess,
  reservedSymbol,
  splice,
  unquote,
  Unquote,
  assumeIsFile,
  Splice,
} from "@custard-lang/processor/dist/types.js";
import { ExpectNever } from "@custard-lang/processor/src/util/error.js";

const path = "test";

const inputOf = (contents: string): ReaderInput =>
  readerInput(assumeIsFile(path), contents);
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
            locatedPropertyAccess(
              locatedCuSymbol("pl", location(1, 3)),
              "us",
              location(1, 5),
            ),
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
            locatedPropertyAccess(
              locatedCuSymbol("pl", location(1, 3)),
              "us",
              location(1, 5),
            ),
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

    test('`{ a: { c aa: ( 1.1 2.1 3.3 ) cc ab: 3.0 ...(def ghi) } bc: "jkl" cd }`', () => {
      expect(
        readStr(
          inputOf(
            '{ a: {\nc\naa: ( 1.1 2.1 3.3\n) cc ab: 3.0 \n...(def ghi) }\nbc: "jkl" cd}',
          ),
        ),
      ).toEqual(
        locatedCuObject(
          [
            keyValue<Form<Location>, Form<Location>, Form<Location>, Location>(
              locatedCuSymbol("a", location(1, 3)),
              locatedCuObject(
                [
                  locatedCuSymbol("c", location(2, 1)),
                  keyValue<
                    Form<Location>,
                    Form<Location>,
                    Form<Location>,
                    Location
                  >(
                    locatedCuSymbol("aa", location(3, 1)),
                    locatedList(
                      [
                        locatedFloat64(1.1, location(3, 7)),
                        locatedFloat64(2.1, location(3, 11)),
                        locatedFloat64(3.3, location(3, 15)),
                      ],
                      location(3, 5),
                    ),
                  ),
                  locatedCuSymbol("cc", location(4, 3)),
                  keyValue<
                    Form<Location>,
                    Form<Location>,
                    Form<Location>,
                    Location
                  >(
                    locatedCuSymbol("ab", location(4, 6)),
                    locatedFloat64(3.0, location(4, 10)),
                  ),
                  locatedSplice(
                    locatedList(
                      [
                        locatedCuSymbol("def", location(5, 5)),
                        locatedCuSymbol("ghi", location(5, 9)),
                      ],
                      location(5, 4),
                    ),
                    location(5, 1),
                  ),
                ],
                location(1, 6),
              ),
            ),
            keyValue<Form<Location>, Form<Location>, Form<Location>, Location>(
              locatedCuSymbol("bc", location(6, 1)),
              locatedCuString("jkl", location(6, 5)),
            ),
            locatedCuSymbol("cd", location(6, 11)),
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

  describe("PropertyAccess", () => {
    test("`a.b.c` -> `a.b.c`", () => {
      expect(readStr(inputOf("a.b.c"))).toEqual(
        locatedPropertyAccess(
          locatedPropertyAccess(
            locatedCuSymbol("a", location(1, 1)),
            "b",
            location(1, 2),
          ),
          "c",
          location(1, 4),
        ),
      );
    });
    test("` aa.bc ` -> `aa.bc`", () => {
      expect(readStr(inputOf(" aa.bc "))).toEqual(
        locatedPropertyAccess(
          locatedCuSymbol("aa", location(1, 2)),
          "bc",
          location(1, 4),
        ),
      );
    });

    test("`1.abc` -> `1.abc`", () => {
      expect(readStr(inputOf("1.abc"))).toEqual(
        locatedPropertyAccess(
          locatedInteger32(1, location(1, 1)),
          "abc",
          location(1, 2),
        ),
      );
    });
    test("`1.0.abc` -> `1.0.abc`", () => {
      expect(readStr(inputOf("1.0.abc"))).toEqual(
        locatedPropertyAccess(
          locatedFloat64(1, location(1, 1)),
          "abc",
          location(1, 4),
        ),
      );
    });
    test('`"foo".bar` -> `"foo".bar`', () => {
      expect(readStr(inputOf('"foo".bar'))).toEqual(
        locatedPropertyAccess(
          locatedCuString("foo", location(1, 1)),
          "bar",
          location(1, 6),
        ),
      );
    });

    test("`(a).d` -> `(a).d`", () => {
      expect(readStr(inputOf("(a).d"))).toEqual(
        locatedPropertyAccess(
          locatedList([locatedCuSymbol("a", location(1, 2))], location(1, 1)),
          "d",
          location(1, 4),
        ),
      );
    });
    test("`[a b c].d` -> `[a b c].d`", () => {
      expect(readStr(inputOf("[a b c].d"))).toEqual(
        locatedPropertyAccess(
          locatedCuArray(
            [
              locatedCuSymbol("a", location(1, 2)),
              locatedCuSymbol("b", location(1, 4)),
              locatedCuSymbol("c", location(1, 6)),
            ],
            location(1, 1),
          ),
          "d",
          location(1, 8),
        ),
      );
    });
    test("`{a: 1}.b` -> `{a: 1}.b`", () => {
      expect(readStr(inputOf("{a: 1}.b"))).toEqual(
        locatedPropertyAccess(
          locatedCuObject(
            [
              keyValue<
                Form<Location>,
                Form<Location>,
                Form<Location>,
                Location
              >(
                locatedCuSymbol("a", location(1, 2)),
                locatedInteger32(1, location(1, 5)),
              ),
            ],
            location(1, 1),
          ),
          "b",
          location(1, 7),
        ),
      );
    });

    test("`$a.b.c` -> `$a.b.c`", () => {
      expect(readStr(inputOf("$a.b.c"))).toEqual(
        locatedPropertyAccess(
          locatedPropertyAccess(
            locatedUnquote(
              locatedCuSymbol("a", location(1, 2)),
              location(1, 1),
            ),
            "b",
            location(1, 3),
          ),
          "c",
          location(1, 5),
        ),
      );
    });

    test("`...a.b` -> `...a.b`", () => {
      expect(readStr(inputOf("...a.b"))).toEqual(
        locatedSplice(
          locatedPropertyAccess(
            locatedCuSymbol("a", location(1, 4)),
            "b",
            location(1, 5),
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

    test("when a non-symbol token is used as the rhs of a property access", () => {
      const expected = readStr(inputOf("a.1"));
      expect(expected).toBeInstanceOf(ParseErrorSkipping);
      expect((expected as ParseErrorSkipping<unknown>).message).toEqual(
        'Expected period followed by symbol for property access, but got number: "1", at line 1, column 3 of test',
      );
    });
  });
});

describe("readResumably", () => {
  describe("can resume parsing complex structures from anywhere", () => {
    // Most complex test case using all the syntax rules:
    // number, string, array, list, object, unquote, splice, symbol, property access
    // prettier-ignore
    const tokens1 = [
      "{",
      // string key with property access value
      // NOTE: A period "." should be treated as a separate token. However, due
      //       to the way the reader is implemented, this test feeds the period
      //       as part of the "obj." token. This is intentional to test that
      //       the reader can see the input is incomplete and resume correctly.
      '"', "k", "e", "y", "1", '"', ":", " ", "obj.", "prop.", "", "value", " ",
      // computed key with array value containing numbers and strings
      "[", "(", "plusF", " ", "1", " ", "2", ")", "]", ":", " ", "[", "123", " ", '"', "t", "e", "s", "t", '"', "]", " ",
      // symbol key with list value containing unquote and splice
      "data", ":", " ", "(", "list", " ", "$", "var", " ", "...", "$", "items", ")",
      "...", " ", "moreData",
      " ", "}"
    ];
    for (let i = 0; i < tokens1.length - 1; ++i) {
      // Test resumability at every token boundary
      test(`1-${i}`, () => {
        const fullInput = tokens1.join("");
        const expected = readStr(inputOf(fullInput));
        if (isParseError(expected)) {
          throw expected;
        }

        const partialInput = tokens1.slice(0, i).join("");
        const partialResult = readResumably(inputOf(partialInput));
        // Should get ParseErrorWantingMore for incomplete input
        expect(partialResult).toBeInstanceOf(ParseErrorWantingMore);

        const remainingInput = tokens1.slice(i).join("");
        const resumedResult = (
          partialResult as ParseErrorWantingMore<Form<Location>>
        ).resume(remainingInput);

        if (resumedResult instanceof Error) {
          throw resumedResult;
        }
        expect(forgetLocationOfForm(resumedResult)).toEqual(
          forgetLocationOfForm(expected),
        );
      });
    }

    // [{ ...other name: "hello world" } [obj.method $variable] (concat ...$args)]
    // prettier-ignore
    const tokens2 = [
      "[",
      // Object with string value split at character level
      "{", "...", "other", " ", "name", ":", " ", '"', "h", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d", '"', " ", "}",
      " ",
      // Array with property access and unquote
      // NOTE: A period "." should be treated as a separate token. However, due
      //       to the way the reader is implemented, this test feeds the period
      //       as part of the "obj." token. This is intentional to test that
      //       the reader can see the input is incomplete and resume correctly.
      "[", "obj.", "method", " ", "$", "variable", "]",
      " ",
      // Function call with splice
      "(", "concat", " ", "...", "$", "args", ")",
      "]"
    ];
    for (let i = 0; i < tokens2.length - 1; ++i) {
      test(`2-${i}`, () => {
        const fullInput = tokens2.join("");
        const expected = readStr(inputOf(fullInput));
        if (isParseError(expected)) {
          throw expected;
        }

        const partialInput = tokens2.slice(0, i).join("");
        const partialResult = readResumably(inputOf(partialInput));
        expect(partialResult).toBeInstanceOf(ParseErrorWantingMore);

        const remainingInput = tokens2.slice(i).join("");
        const resumedResult = (
          partialResult as ParseErrorWantingMore<Form<Location>>
        ).resume(remainingInput);
        if (resumedResult instanceof Error) {
          throw resumedResult;
        }
        expect(forgetLocationOfForm(resumedResult)).toEqual(
          forgetLocationOfForm(expected),
        );
      });
    }
  });
});

function forgetLocationOfForm(form: Form<Location>): Form {
  // Remove the location information from the form.
  // Used to compare forms without location information.

  if (isList(form)) {
    return list(...form.values.map(forgetLocationOfForm));
  }

  if (isCuArray(form)) {
    return cuArray(...form.map(forgetLocationOfForm));
  }

  if (isCuObject(form)) {
    return cuObject(
      ...form.keyValues.map((kv) => {
        if (isKeyValue(kv)) {
          const { key } = kv;
          const k = isComputedKey(key)
            ? computedKey(forgetLocationOfForm(key.value))
            : forgetLocationOfForm(key);
          return keyValue(
            k as KeyValueKey<Form, Form>,
            forgetLocationOfForm(kv.value),
          );
        }
        if (isCuSymbol(kv)) {
          return forgetLocationOfForm(kv) as CuSymbol;
        }
        if (isUnquote(kv)) {
          return forgetLocationOfForm(kv) as Unquote<Form>;
        }
        if (isSplice(kv)) {
          return forgetLocationOfForm(kv) as Splice<Form>;
        }
        throw ExpectNever(kv);
      }),
    );
  }

  if (isInteger32(form)) {
    return integer32(form.valueOf());
  }

  if (isFloat64(form)) {
    return float64(form.valueOf());
  }

  if (isCuString(form)) {
    return cuString(form.valueOf());
  }

  if (isReservedSymbol(form)) {
    return reservedSymbol(form.valueOf());
  }

  if (isCuSymbol(form)) {
    return cuSymbol(form.value);
  }

  if (isPropertyAccess(form)) {
    return propertyAccess(forgetLocationOfForm(form.left), form.right);
  }

  if (isUnquote(form)) {
    return unquote(forgetLocationOfForm(form.value));
  }

  if (isSplice(form)) {
    return splice(forgetLocationOfForm(form.value));
  }

  throw ExpectNever(form);
}
