import type {
  Eof,
  MatchedToken,
  SpaceSkippingScanner,
  TokenAndRE,
  TokenKind,
} from "./scanner.js";
import { isEof, eof } from "./scanner.js";
import {
  locatedCuArray,
  locatedCuObject,
  locatedCuString,
  locatedCuSymbol,
  locatedFloat64,
  locatedInteger32,
  locatedList,
  locatedPropertyAccess,
  locatedReservedSymbol,
  locatedSplice,
  locatedUnquote,
} from "./internal/types.js";
import {
  type Form,
  type Location,
  type KeyValue,
  type CuSymbol,
  isCuSymbol,
  isUnquote,
  type Unquote,
  keyValue,
  isCuString,
  isCuArray,
  computedKey,
  type Splice,
  isSplice,
} from "./types.js";

export const tokens: TokenAndRE[] = [
  { t: "open paren", r: /\(/y },
  { t: "close paren", r: /\)/y },

  { t: "open bracket", r: /\[/y },
  { t: "close bracket", r: /\]/y },

  { t: "open brace", r: /\{/y },
  { t: "close brace", r: /\}/y },

  { t: "colon", r: /:/y },
  { t: "string", r: /"(?:\\.|[^\\"])*"?/y },
  { t: "number", r: /-?\d+(?<fractional>\.\d+)?/y },
  { t: "symbol", r: /[a-z_][\w$]*/iy },

  { t: "unquote sign", r: /\$/y },
  { t: "splice sign", r: /\.\.\./y },

  { t: "period", r: /\./y },

  { t: "UNKNOWN", r: /[^()\[\]{}:"\-\da-z_$.\s]*/y },
];
const tokenInsideString = /(?:\\.|[^\\"])*"?/y;

export type ParseError<R> = ParseErrorWantingMore<R> | ParseErrorSkipping<R>;

class ParseErrorBase extends Error {
  override name = "ParseErrorBase";
  location: Location;

  constructor(message: string, matchedToken: MatchedToken | Eof) {
    super(message);
    const { f, l, c } = matchedToken;
    this.location = { l, c, f };
  }
}

function buildCommonErrorMessage(
  messageOrExpected: string,
  matchedToken: MatchedToken | Eof,
): string {
  const { f, l, c } = matchedToken;
  if (isEof(matchedToken)) {
    return `Expected ${messageOrExpected}, but got end of input, at line ${l}, column ${c} of ${f}`;
  }
  const { t, m } = matchedToken;
  return `Expected ${messageOrExpected}, but got ${t}: "${m[0]}", at line ${l}, column ${c} of ${f}`;
}

export class ParseErrorWantingMore<R> extends ParseErrorBase {
  override name = "ParseErrorWantingMore";
  resume: (more: string) => R | ParseError<R>;

  constructor(
    message: string,
    eof: Eof,
    resume: (more: string) => R | ParseError<R>,
  ) {
    super(message, eof);
    this.resume = resume;
  }

  static ofCommonMessage<R>(
    messageOrExpected: string,
    matchedToken: Eof,
    resume: (more: string) => R | ParseError<R>,
  ): ParseErrorWantingMore<R> {
    return new ParseErrorWantingMore(
      buildCommonErrorMessage(messageOrExpected, matchedToken),
      matchedToken,
      resume,
    );
  }
}

export class ParseErrorSkipping<R> extends ParseErrorBase {
  override name = "ParseErrorSkipping";
  resume: () => R | ParseError<R>;

  constructor(
    message: string,
    matchedToken: MatchedToken | Eof,
    resume: () => R | ParseError<R>,
  ) {
    super(message, matchedToken);
    this.resume = resume;
  }

  static ofCommonMessage<R>(
    messageOrExpected: string,
    matchedToken: MatchedToken | Eof,
    resume: () => R | ParseError<R>,
  ): ParseErrorSkipping<R> {
    return new ParseErrorSkipping(
      buildCommonErrorMessage(messageOrExpected, matchedToken),
      matchedToken,
      resume,
    );
  }
}

export function isParseError<R>(r: unknown): r is ParseError<R> {
  return r instanceof ParseErrorBase;
}

export function isParseErrorWantingMore<R>(
  r: unknown,
): r is ParseErrorWantingMore<R> {
  return r instanceof ParseErrorWantingMore;
}

export function isParseErrorSkipping<R>(
  r: unknown,
): r is ParseErrorSkipping<R> {
  return r instanceof ParseErrorSkipping;
}

export function form<R>(
  s: SpaceSkippingScanner,
  k: (result: Form<Location> | ParseError<R>) => R | ParseError<R>,
): R | ParseError<R> {
  return formP(s, true, (_, result) => k(result));
}

function formP<R>(
  s: SpaceSkippingScanner,
  withPropertyAccess: boolean,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  const kWithPropertyAccess = (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ): R | ParseError<R> => {
    if (isParseError(result)) {
      return k(s, result);
    }
    if (withPropertyAccess) {
      return propertyAccessP(
        s,
        result,
        (s, propertyAccessResult: Form<Location> | ParseError<R>) => {
          return k(s, propertyAccessResult);
        },
      );
    }
    return k(s, result);
  };

  const token = handleEof(s, "form", () => formP(s, withPropertyAccess, k));
  if (token instanceof ParseErrorWantingMore) {
    return token;
  }
  const { l, c, f } = token;
  switch (token.t) {
    case "open paren":
      return listP(s, { l, c, f }, kWithPropertyAccess);
    case "open bracket":
      return cuArrayP(s, { l, c, f }, kWithPropertyAccess);
    case "open brace":
      return cuObjectP(s, { l, c, f }, kWithPropertyAccess);
    case "string":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return stringP(s, token, kWithPropertyAccess);
    case "number":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return numberP(s, token, kWithPropertyAccess);
    case "symbol":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return symbolP(s, token, kWithPropertyAccess);
    case "unquote sign":
      return unquoteP(s, { l, c, f }, kWithPropertyAccess);
    case "splice sign":
      return spliceP(s, { l, c, f }, kWithPropertyAccess);
    default:
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token to avoid infinite loop
      return kWithPropertyAccess(
        s,
        ParseErrorSkipping.ofCommonMessage("form", token, () =>
          formP(s, withPropertyAccess, kWithPropertyAccess),
        ),
      );
  }
}

function listP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return untilClose<R, Form<Location>>(
    s,
    "close paren",
    (s, k) => formP(s, true, k),
    (s, v) => {
      if (isParseError(v)) {
        return k(s, v);
      }
      return k(s, locatedList(v, l));
    },
  );
}

function cuArrayP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return untilClose<R, Form<Location>>(
    s,
    "close bracket",
    (s, k) => formP(s, true, k),
    (s, v) => {
      if (isParseError(v)) {
        return k(s, v);
      }
      return k(s, locatedCuArray(v, l));
    },
  );
}

function cuObjectP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return untilClose<R, KeyValueOrSymbolOrStringOrUnquoteOrSplice>(
    s,
    "close brace",
    keyValueOrSymbolOrStringOrUnquote,
    (s, v) => {
      if (isParseError(v)) {
        return k(s, v);
      }
      return k(s, locatedCuObject(v, l));
    },
  );
}

function untilClose<R, F>(
  s: SpaceSkippingScanner,
  close: TokenKind,
  fn: (
    s: SpaceSkippingScanner,
    k: (
      s: SpaceSkippingScanner,
      result: F | ParseError<R>,
    ) => R | ParseError<R>,
  ) => R | ParseError<R>,
  k: (
    s: SpaceSkippingScanner,
    result: F[] | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop open paren

  const result: F[] = [];

  function loop(): R | ParseError<R> {
    const next = handleEof(s, `form or ${close}`, loop);
    if (next instanceof ParseErrorWantingMore) {
      return k(s, next);
    }
    if (next.t === close) {
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // drop close paren
      return k(s, result);
    }
    if (next.t === "UNKNOWN") {
      return ParseErrorSkipping.ofCommonMessage("form", next, () => {
        // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
        s.next(); // drop unknown token
        return loop();
      });
    }

    // call form then, append
    return fn(s, (s, fnResult) => {
      if (isParseError(fnResult)) {
        return k(s, fnResult);
      }
      result.push(fnResult);
      return loop();
    });
  }

  return loop();
}

type KeyValueOrSymbolOrStringOrUnquoteOrSplice =
  | KeyValue<Form<Location>, Form<Location>, Form<Location>, Location>
  | CuSymbol<Location>
  | Unquote<Form<Location>, Location>
  | Splice<Form<Location>, Location>;

function keyValueOrSymbolOrStringOrUnquote<R>(
  s: SpaceSkippingScanner,
  k: (
    s: SpaceSkippingScanner,
    result: KeyValueOrSymbolOrStringOrUnquoteOrSplice | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return formP(s, true, (s, key) => {
    if (isParseError(key)) {
      return k(s, key);
    }
    return (function colonAndValue(): R | ParseError<R> {
      const colonOrOther = handleEof(
        s,
        "colon, close brace, or form",
        colonAndValue,
      );
      if (colonOrOther instanceof ParseErrorWantingMore) {
        return colonOrOther;
      }

      if (colonOrOther.t === "colon") {
        return (function keyValueOrSymbolOrStringOrUnquoteAgain():
          | R
          | ParseError<R> {
          // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
          s.next(); // drop colon

          return formP(s, true, (s, value) => {
            if (isParseError(value)) {
              return k(s, value);
            }
            if (isCuArray(key)) {
              const [computedKeyForm, ...rest] = key;
              if (computedKeyForm === undefined) {
                const { l, c } = key.extension;
                return k(
                  s,
                  ParseErrorSkipping.ofCommonMessage(
                    `No form given to a computed key at line ${l}, column ${c}`,
                    colonOrOther,
                    keyValueOrSymbolOrStringOrUnquoteAgain,
                  ),
                );
              }
              if (rest.length > 0) {
                const { l, c } = key.extension;
                return k(
                  s,
                  ParseErrorSkipping.ofCommonMessage(
                    `Expected a computed key, but array at line ${l}, column ${c}`,
                    colonOrOther,
                    keyValueOrSymbolOrStringOrUnquoteAgain,
                  ),
                );
              }
              return k(s, keyValue(computedKey(computedKeyForm), value));
            }

            if (isCuSymbol(key) || isCuString(key) || isUnquote(key)) {
              return k(s, keyValue(key, value));
            }

            const { l, c } = key.extension;
            return k(
              s,
              ParseErrorSkipping.ofCommonMessage(
                `key of an object must be a symbol, string, or computed key, but ${key.constructor.name} at line ${l}, column ${c}`,
                colonOrOther,
                keyValueOrSymbolOrStringOrUnquoteAgain,
              ),
            );
          });
        })();
      }

      if (isCuSymbol(key) || isUnquote(key) || isSplice(key)) {
        return k(s, key);
      }
      const { l, c } = key.extension;
      return k(
        s,
        new ParseErrorSkipping(
          `Key of an object without a value must be a symbol, but ${key.constructor.name} at line ${l}, column ${c}`,
          colonOrOther,
          () => keyValueOrSymbolOrStringOrUnquote(s, k),
        ),
      );
    })();
  });
}

function stringP<R>(
  s: SpaceSkippingScanner,
  token: MatchedToken,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  const {
    l,
    c,
    f,
    m: [stringLiteral],
  } = token;
  if (stringLiteral === '"' || !/[^\\]?"$/.test(stringLiteral)) {
    let result = stringLiteral;
    return k(
      s,
      new ParseErrorWantingMore(
        `Unterminated string literal: ${stringLiteral} at line ${l}, column ${c}`,
        eof({ l, c, f }),
        function stringResume(more: string): R | ParseError<R> {
          s.feed(more);
          const remaining = s.scan(tokenInsideString);
          if (remaining === null || isEof(remaining)) {
            return new ParseErrorWantingMore(
              "Unterminated string literal",
              eof({ l, c, f }),
              stringResume,
            );
          }
          result += remaining.m[0];
          if (result.endsWith('"')) {
            s.overwriteLastToken({
              t: "string",
              m: [result] as RegExpExecArray,
              l,
              c,
              f,
            });
            // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
            s.next(); // drop the last token inside the string literal
            return k(
              s,
              locatedCuString(JSON.parse(result) as string, { l, c, f }),
            );
          }
          return new ParseErrorWantingMore(
            `Still unterminated string literal: ${result}`,
            eof({ l, c: c + result.length, f }),
            stringResume,
          );
        },
      ),
    );
  }
  return k(
    s,
    locatedCuString(JSON.parse(stringLiteral) as string, { l, c, f }),
  );
}

function numberP<R>(
  s: SpaceSkippingScanner,
  token: MatchedToken,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  const { l, c, f, m } = token;

  if (m.groups?.fractional === undefined) {
    return k(s, locatedInteger32(parseInt(m[0]), { l, c, f }));
  }

  return k(s, locatedFloat64(parseFloat(m[0]), { l, c, f }));
}

function symbolP<R>(
  s: SpaceSkippingScanner,
  token: MatchedToken,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  const { l, c, f } = token;
  const v = token.m[0];
  switch (v) {
    case "true":
      return k(s, locatedReservedSymbol(true, { l, c, f }));

    case "false":
      return k(s, locatedReservedSymbol(false, { l, c, f }));

    case "none":
      return k(s, locatedReservedSymbol(null, { l, c, f }));

    default:
      return k(s, locatedCuSymbol(v, { l, c, f }));
  }
}

function propertyAccessP<R>(
  s: SpaceSkippingScanner,
  form: Form<Location>,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  const tokenPeriod = s.peek();
  if (isEof(tokenPeriod)) {
    return k(s, form);
  }
  if (tokenPeriod.t === "period") {
    // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
    s.next(); // drop period
    function propertyAccessAfterPeriod(
      s: SpaceSkippingScanner,
    ): R | ParseError<R> {
      const token = handleEof(s, "symbol", () => propertyAccessAfterPeriod(s));
      if (token instanceof ParseErrorWantingMore) {
        return token;
      }
      if (token.t === "symbol") {
        // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
        s.next(); // drop the symbol token
        const { l, c, f } = tokenPeriod;
        const property = token.m[0];
        return propertyAccessP(
          s,
          locatedPropertyAccess(form, property, { l, c, f }),
          k,
        );
      }
      return k(
        s,
        ParseErrorSkipping.ofCommonMessage(
          "period followed by symbol for property access",
          token,
          () => {
            // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
            s.next(); // drop period
            return propertyAccessAfterPeriod(s);
          },
        ),
      );
    }
    return propertyAccessAfterPeriod(s);
  }
  return k(s, form);
}

function unquoteP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "$"
  return formP(s, false, (s, v) => {
    if (isParseError(v)) {
      return k(s, v);
    }
    return k(s, locatedUnquote(v, l));
  });
}

function spliceP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    s: SpaceSkippingScanner,
    result: Form<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "..."
  return formP(s, true, (s, v) => {
    if (isParseError(v)) {
      return k(s, v);
    }
    return k(s, locatedSplice(v, l));
  });
}

function handleEof<R>(
  s: SpaceSkippingScanner,
  expected: TokenKind,
  resume: () => R | ParseError<R>,
): ParseErrorWantingMore<R> | MatchedToken {
  const next = s.peek();
  if (isEof(next)) {
    return ParseErrorWantingMore.ofCommonMessage(expected, next, (more) => {
      s.feed(more);
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // go to next token
      return resume();
    });
  }
  return next;
}
