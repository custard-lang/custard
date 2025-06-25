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
  type List,
  type CuObject,
  type CuString,
  type Integer32,
  type Float64,
  type Location,
  type KeyValue,
  type CuSymbol,
  isCuSymbol,
  type CuArray,
  isUnquote,
  type Unquote,
  keyValue,
  isCuString,
  isCuArray,
  computedKey,
  type Splice,
} from "./types.js";

export const tokens: TokenAndRE[] = [
  {t: "open paren", r: /\(/y},
  {t: "close paren", r: /\)/y},

  {t: "open bracket", r: /\[/y},
  {t: "close bracket", r: /\]/y},

  {t: "open brace", r: /\{/y},
  {t: "close brace", r: /\}/y},

  {t: "colon", r: /:/y},
  {t: "string", r: /"(?:\\.|[^\\"])*"?/y},
  {t: "number", r: /-?\d+(?<fractional>\.\d+)?/y},
  {t: "symbol or property access", r: /[a-z_][\w$.]*/iy},

  {t: "unquote sign", r: /\$/y},
  {t: "splice sign", r: /\.\.\./y},
  {t: "UNKNOWN", r: /[^()\[\]{}:"\-\d,a-z_$.\s]+/y},
];

export type ParseError<R> = ParseErrorWantingMore<R> | ParseErrorSkipping<R>;

class ParseErrorBase extends Error {
  override name = "ParseErrorBase";
  location: Location;

  constructor(message: string, matchedToken: MatchedToken | Eof) {
    super(message);
    const {f, l, c} = matchedToken;
    this.location = {l, c, f};
  }
}

function buildCommonErrorMessage(messageOrExpected: string, matchedToken: MatchedToken | Eof): string {
  const {f, l, c} = matchedToken;
  if (isEof(matchedToken)) {
    return `Expected ${messageOrExpected}, but got end of input, at line ${l}, column ${c} of ${f}`;
  }
  const {t, m} = matchedToken;
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

export function form<R>(
  s: SpaceSkippingScanner,
  k: (result: Form<Location> | ParseError<R>) => R | ParseError<R>,
): R | ParseError<R> {
  const token = handleEof(s, "form", () => form(s, k));
  if (token instanceof ParseErrorWantingMore) {
    return token;
  }

  const {l, c, f} = token;
  switch (token.t) {
    case "open paren":
      return listP(s, {l, c, f}, k);
    case "open bracket":
      return cuArrayP(s, {l, c, f}, k);
    case "open brace":
      return cuObjectP(s, {l, c, f}, k);
    case "string":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return string(s, token, k);
    case "number":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return number(token, k);
    case "symbol or property access":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return symbolOrPropertyAccess(s, token, k);
    case "unquote sign":
      return unquoteP(s, {l, c, f}, k);
    case "splice sign":
      return spliceP(s, {l, c, f}, k);
    default:
      return k(ParseErrorSkipping.ofCommonMessage("form", token, () => form(s, k)));
  }
}

function listP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    result: List<Form<Location>, Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return untilClose<R, Form<Location>>(s, "close paren", form, (v) => {
    if (isParseError(v)) {
      return k(v);
    }
    return k(locatedList(v, l));
  });
}

function cuArrayP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    result: CuArray<Form<Location>, Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return untilClose<R, Form<Location>>(s, "close bracket", form, (v) => {
    if (isParseError(v)) {
      return k(v);
    }
    return k(locatedCuArray(v, l));
  });
}

function cuObjectP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    result:
      | CuObject<
      Form<Location>,
      Form<Location>,
      Form<Location>,
      Form<Location>,
      Location
    >
      | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return untilClose<R, KeyValueOrSymbolOrStringOrUnquote>(
    s,
    "close brace",
    keyValueOrSymbolOrStringOrUnquote,
    (v) => {
      if (isParseError(v)) {
        return k(v);
      }
      return k(locatedCuObject(v, l));
    },
  );
}

function untilClose<R, F>(
  s: SpaceSkippingScanner,
  close: TokenKind,
  fn: (
    s: SpaceSkippingScanner,
    k: (result: F | ParseError<R>) => R | ParseError<R>,
  ) => R | ParseError<R>,
  k: (result: F[] | ParseError<R>) => R | ParseError<R>,
): R | ParseError<R> {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop open paren

  const result: F[] = [];

  function loop(): R | ParseError<R> {
    const next = handleEof(s, `form or ${close}`, loop);
    if (next instanceof ParseErrorWantingMore) {
      return k(next);
    }
    if (next.t === close) {
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // drop close paren
      return k(result);
    }
    if (next.t === "UNKNOWN") {
      return ParseErrorSkipping.ofCommonMessage("form", next, () => {
        // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
        s.next(); // drop unknown token
        return loop();
      });
    }

    // call form then, append
    return fn(s, (kfn) => {
      if (isParseError(kfn)) {
        return k(kfn);
      }
      result.push(kfn);
      return loop();
    });
  }

  return loop();
}

type KeyValueOrSymbolOrStringOrUnquote =
  | KeyValue<Form<Location>, Form<Location>, Form<Location>, Location>
  | CuSymbol<Location>
  | Unquote<Form<Location>, Location>;

function keyValueOrSymbolOrStringOrUnquote<R>(
  s: SpaceSkippingScanner,
  k: (
    result: KeyValueOrSymbolOrStringOrUnquote | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  return form(s, (key) => {
    if (isParseError(key)) {
      return k(key);
    }
    const colonOrOther = handleEof(s, "colon, close brace, or form", () =>
      keyValueOrSymbolOrStringOrUnquote(s, k),
    );
    if (colonOrOther instanceof ParseErrorWantingMore) {
      return colonOrOther;
    }

    if (colonOrOther.t === "colon") {
      return (function keyValueOrSymbolOrStringOrUnquoteAgain():
        | R
        | ParseError<R> {
        // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
        s.next(); // drop colon (or other invalid token)

        return form(s, (value) => {
          if (isParseError(value)) {
            return k(value);
          }

          if (isCuArray(key)) {
            const [computedKeyForm, ...rest] = key;
            if (computedKeyForm === undefined) {
              const {l, c} = key.extension;
              return k(
                ParseErrorSkipping.ofCommonMessage(
                  `No form given to a computed key at line ${l}, column ${c}`,
                  colonOrOther,
                  keyValueOrSymbolOrStringOrUnquoteAgain,
                ),
              );
            }
            if (rest.length > 0) {
              const {l, c} = key.extension;
              return k(
                ParseErrorSkipping.ofCommonMessage(
                  `Expected a computed key, but array at line ${l}, column ${c}`,
                  colonOrOther,
                  keyValueOrSymbolOrStringOrUnquoteAgain,
                ),
              );
            }
            return k(keyValue(computedKey(computedKeyForm), value));
          }
          if (isCuSymbol(key) || isCuString(key) || isUnquote(key)) {
            return k(keyValue(key, value));
          }

          const {l, c} = key.extension;
          return k(
            ParseErrorSkipping.ofCommonMessage(
              `key of an object must be a symbol, string, or computed key, but ${key.constructor.name} at line ${l}, column ${c}`,
              colonOrOther,
              keyValueOrSymbolOrStringOrUnquoteAgain,
            ),
          );
        });
      })();
    }
    if (isCuSymbol(key) || isUnquote(key)) {
      return k(key);
    }
    const {l, c} = key.extension;
    return k(
      ParseErrorSkipping.ofCommonMessage(
        `key of an object without a value must be a symbol, but ${key.constructor.name} at line ${l}, column ${c}`,
        colonOrOther,
        () => keyValueOrSymbolOrStringOrUnquote(s, k),
      ),
    );
  });
}

function string<R>(
  s: SpaceSkippingScanner,
  token: MatchedToken,
  k: (result: CuString<Location> | ParseError<R>) => R | ParseError<R>,
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
      new ParseErrorWantingMore(
        `Unterminated string literal: ${stringLiteral} at line ${l}, column ${c}`,
        eof({l, c, f}),
        function stringResume(more: string): R | ParseError<R> {
          s.feed(more);
          const remaining = s.scan(/(?:\\.|[^\\"])*"?/y);
          if (remaining === null || isEof(remaining)) {
            return new ParseErrorWantingMore(
              "Unterminated string literal",
              eof({l, c, f}),
              stringResume,
            );
          }
          result += remaining.m[0];
          if (result.endsWith('"')) {
            return k(
              locatedCuString(JSON.parse(result) as string, {l, c, f}),
            );
          }
          return new ParseErrorWantingMore(
            `Still unterminated string literal: ${result}`,
            eof({l, c: c + result.length, f}),
            stringResume,
          );
        },
      ),
    );
  }
  return k(locatedCuString(JSON.parse(stringLiteral) as string, {l, c, f}));
}

function number<R>(
  token: MatchedToken,
  k: (
    result: Integer32<Location> | Float64<Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  const {l, c, f, m} = token;

  if (m.groups?.fractional === undefined) {
    return k(locatedInteger32(parseInt(m[0]), {l, c, f}));
  }

  return k(locatedFloat64(parseFloat(m[0]), {l, c, f}));
}

function symbolOrPropertyAccess<R>(
  s: SpaceSkippingScanner,
  token: MatchedToken,
  k: (result: Form<Location> | ParseError<R>) => R | ParseError<R>,
): R | ParseError<R> {
  const {l, c, f} = token;
  const v = token.m[0];
  switch (v) {
    case "true":
      return k(locatedReservedSymbol(true, {l, c, f}));

    case "false":
      return k(locatedReservedSymbol(false, {l, c, f}));

    case "none":
      return k(locatedReservedSymbol(null, {l, c, f}));

    default: {
      // TODO: Insufficient validation
      const parts = v.split(".");
      if (parts.length === 0) {
        return k(
          new ParseErrorSkipping(
            `Invalid symbol or property access: ${v} at line ${l}, column ${c}`,
            token,
            function symbolOrPropertyAccessAgain() {
              // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
              s.next();
              return form(s, k);
            },
          ),
        );
      }
      if (parts.length > 1) {
        return k(
          locatedPropertyAccess(parts as [string, ...string[]], {
            l,
            c,
            f,
          }),
        );
      }
      return k(locatedCuSymbol(v, {l, c, f}));
    }
  }
}

function unquoteP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    result: Unquote<Form<Location>, Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "$"
  return form(s, (v) => {
    if (isParseError(v)) {
      return k(v);
    }
    return k(locatedUnquote(v, l));
  });
}

function spliceP<R>(
  s: SpaceSkippingScanner,
  l: Location,
  k: (
    result: Splice<Form<Location>, Location> | ParseError<R>,
  ) => R | ParseError<R>,
): R | ParseError<R> {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "..."
  return form(s, (v) => {
    if (isParseError(v)) {
      return k(v);
    }
    return k(locatedSplice(v, l));
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
