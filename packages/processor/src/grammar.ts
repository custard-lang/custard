import type {
  MatchedToken,
  SpaceSkippingScanner,
  TokenAndRE,
  TokenKind,
} from "./scanner.js";
import { EOF } from "./scanner.js";
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
  type ReservedSymbol,
  type PropertyAccess,
  isUnquote,
  type Unquote,
  keyValue,
  isCuString,
  isCuArray,
  computedKey,
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
  { t: "symbol or property access", r: /[a-z_][\w$.]*/iy },

  { t: "unquote sign", r: /\$/y },
  { t: "splice sign", r: /\.\.\./y },
];

export class ParseError extends Error {
  override name = "ParseError";

  constructor(messageOrExpected: string, matchedToken?: MatchedToken | EOF) {
    if (matchedToken === undefined) {
      super(messageOrExpected);
      return;
    }
    if (matchedToken === EOF) {
      super(`Expected ${messageOrExpected}, but got end of input`);
      return;
    }
    const { l, c, t, v } = matchedToken;
    super(
      `Expected ${messageOrExpected}, but got ${t}: "${v[0]}", at line ${l}, column ${c}`,
    );
  }

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isParseError = true;
  static is(e: unknown): e is ParseError {
    return (e as { [key: string]: unknown } | null)?._cu$isParseError === true;
  }
}

export function form(s: SpaceSkippingScanner): Form<Location> | ParseError {
  const token = s.peek();
  if (token === EOF) {
    return new ParseError("form", EOF);
  }

  const { l, c, f } = token;
  switch (token.t) {
    case "open paren":
      return listP(s, { l, c, f });
    case "open bracket":
      return cuArrayP(s, { l, c, f });
    case "open brace":
      return cuObjectP(s, { l, c, f });
    case "string":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return string(token);
    case "number":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return number(token);
    case "symbol or property access":
      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      s.next(); // Drop the peeked token
      return symbolOrPropertyAccess(token);
    case "unquote sign":
      return unquoteP(s, { l, c, f });
    case "splice sign":
      return spliceP(s, { l, c, f });
    default:
      return new ParseError("form", token);
  }
}

function listP(
  s: SpaceSkippingScanner,
  l: Location,
): List<Form<Location>, Location> | ParseError {
  const v = untilClose(s, "close paren", form);
  if (ParseError.is(v)) {
    return v;
  }
  return locatedList(v, l);
}

function cuArrayP(
  s: SpaceSkippingScanner,
  l: Location,
): CuArray<Form<Location>, Location> | ParseError {
  const v = untilClose(s, "close bracket", form);
  if (ParseError.is(v)) {
    return v;
  }
  return locatedCuArray(v, l);
}

function cuObjectP(
  s: SpaceSkippingScanner,
  l: Location,
):
  | CuObject<
      Form<Location>,
      Form<Location>,
      Form<Location>,
      Form<Location>,
      Location
    >
  | ParseError {
  const v = untilClose(s, "close brace", keyValueOrSymbolOrStringOrUnquote);
  if (ParseError.is(v)) {
    return v;
  }
  return locatedCuObject(v, l);
}

function untilClose<Result>(
  s: SpaceSkippingScanner,
  close: TokenKind,
  fn: (s: SpaceSkippingScanner) => Result | ParseError,
): Result[] | ParseError {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop open paren

  const result: Result[] = [];
  while (true) {
    const next = s.peek();
    if (next === EOF) {
      return new ParseError(`form or ${close}`, EOF);
    }
    if (next.t === close) {
      break;
    }
    const f = fn(s);
    if (ParseError.is(f)) {
      return f;
    }
    result.push(f);
  }
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop close paren
  return result;
}

function keyValueOrSymbolOrStringOrUnquote(
  s: SpaceSkippingScanner,
):
  | KeyValue<Form<Location>, Form<Location>, Form<Location>, Location>
  | CuSymbol<Location>
  | Unquote<Form<Location>, Location>
  | ParseError {
  const key = form(s);
  if (ParseError.is(key)) {
    return key;
  }
  const colonOrOther = s.peek();
  if (colonOrOther === EOF) {
    return new ParseError("colon, close brace, or form", EOF);
  }
  if (colonOrOther.t === "colon") {
    // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
    s.next(); // drop colon
    const value = form(s);
    if (ParseError.is(value)) {
      return value;
    }

    if (isCuArray(key)) {
      const [computedKeyForm, ...rest] = key;
      if (computedKeyForm === undefined) {
        const { l, c } = key.extension;
        return new ParseError(
          `No form given to a computed key at line ${l}, column ${c}`,
        );
      }
      if (rest.length > 0) {
        const { l, c } = key.extension;
        return new ParseError(
          `Expected a computed key, but array at line ${l}, column ${c}`,
        );
      }
      return keyValue(computedKey(computedKeyForm), value);
    }
    if (isCuSymbol(key) || isCuString(key) || isUnquote(key)) {
      return keyValue(key, value);
    }

    const { l, c } = key.extension;
    return new ParseError(
      // TODO: Add rule name instead of constructor.name
      `key of an object must be a symbol, string, or computed key, but ${key.constructor.name} at line ${l}, column ${c}`,
    );
  }
  if (isCuSymbol(key) || isUnquote(key)) {
    return key;
  }
  const { l, c } = key.extension;
  return new ParseError(
    `key of an object without a value must be a symbol, but ${key.constructor.name} at line ${l}, column ${c}`,
  );
}

function string(token: MatchedToken): CuString<Location> | ParseError {
  const {
    l,
    c,
    f,
    v: [stringLiteral],
  } = token;
  if (stringLiteral === '"' || !/[^\\]?"$/.test(stringLiteral)) {
    return new ParseError(
      `Unterminated string literal: ${stringLiteral} at line ${l}, column ${c}`,
    );
  }
  return locatedCuString(JSON.parse(stringLiteral) as string, { l, c, f });
}

function number(token: MatchedToken): Integer32<Location> | Float64<Location> {
  const { l, c, f } = token;
  const m = token.v;

  if (m.groups?.fractional === undefined) {
    return locatedInteger32(parseInt(m[0]), { l, c, f });
  }

  return locatedFloat64(parseFloat(m[0]), { l, c, f });
}

function symbolOrPropertyAccess(
  token: MatchedToken,
):
  | CuSymbol<Location>
  | ReservedSymbol<Location>
  | PropertyAccess<Location>
  | ParseError {
  const { l, c, f } = token;
  const v = token.v[0];
  switch (v) {
    case "true":
      return locatedReservedSymbol(true, { l, c, f });

    case "false":
      return locatedReservedSymbol(false, { l, c, f });

    case "none":
      return locatedReservedSymbol(null, { l, c, f });

    default: {
      // TODO: Insufficient validation
      const parts = v.split(".");
      if (parts.length === 0) {
        return new ParseError(
          `Invalid symbol or property access: ${v} at line ${l}, column ${c}`,
        );
      }
      if (parts.length > 1) {
        return locatedPropertyAccess(parts as [string, ...string[]], {
          l,
          c,
          f,
        });
      }
      return locatedCuSymbol(v, { l, c, f });
    }
  }
}

function unquoteP(
  s: SpaceSkippingScanner,
  l: Location,
): Form<Location> | ParseError {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "$"
  const v = form(s);
  if (ParseError.is(v)) {
    return v;
  }
  return locatedUnquote(v, l);
}

function spliceP(
  s: SpaceSkippingScanner,
  l: Location,
): Form<Location> | ParseError {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "..."
  const v = form(s);
  if (ParseError.is(v)) {
    return v;
  }
  return locatedSplice(v, l);
}
