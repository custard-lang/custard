import type {
  MatchedToken,
  SpaceSkippingScanner,
  TokenAndRE,
  TokenKind,
} from "./scanner.js";
import { EOF } from "./scanner.js";
import {
  type Form,
  type LiteralList,
  type LiteralObject,
  type LiteralString,
  type LiteralInteger32,
  type LiteralFloat64,
  type Location,
  type KeyValue,
  type LiteralCuSymbol,
  isCuSymbol,
  type LiteralArray,
  type ReservedSymbol,
  type LiteralPropertyAccess,
  isUnquote,
  type LiteralUnquote,
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

  constructor(message: string);
  constructor(expected: string, matchedToken: MatchedToken | EOF);
  constructor(messageOrExpected: string, matchedToken?: MatchedToken | EOF) {
    let message: string;
    if (matchedToken === undefined) {
      message = messageOrExpected;
    } else if (matchedToken === EOF) {
      message = `Expected ${messageOrExpected}, but got end of input`;
    } else {
      const { l, c, t, v } = matchedToken;
      message = `Expected ${messageOrExpected}, but got ${t}: "${v[0]}", at line ${l}, column ${c}`;
    }
    super(message);
  }

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isParseError = true;
  static is(e: unknown): e is ParseError {
    return (e as { [key: string]: unknown })?._cu$isParseError === true;
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
      return list(s, { l, c, f });
    case "open bracket":
      return literalArray(s, { l, c, f });
    case "open brace":
      return literalObject(s, { l, c, f });
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
      return unquote(s, { l, c, f });
    case "splice sign":
      return splice(s, { l, c, f });
    default:
      return new ParseError("form", token);
  }
}

function list(
  s: SpaceSkippingScanner,
  l: Location,
): LiteralList<Location> | ParseError {
  const v = untilClose(s, "close paren", form);
  if (ParseError.is(v)) {
    return v;
  }
  return {
    t: "List",
    v,
    ...l,
  };
}

function literalArray(
  s: SpaceSkippingScanner,
  l: Location,
): LiteralArray<Location> | ParseError {
  const v = untilClose(s, "close bracket", form);
  if (ParseError.is(v)) {
    return v;
  }
  return {
    t: "Array",
    v,
    ...l,
  };
}

function literalObject(
  s: SpaceSkippingScanner,
  l: Location,
): LiteralObject<Location> | ParseError {
  const v = untilClose(s, "close brace", keyValueOrSymbolOrUnquote);
  if (ParseError.is(v)) {
    return v;
  }
  return {
    t: "Object",
    v,
    ...l,
  };
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

function keyValueOrSymbolOrUnquote(
  s: SpaceSkippingScanner,
):
  | KeyValue<Location>
  | LiteralCuSymbol<Location>
  | LiteralUnquote<Location>
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
    return [key, value];
  }
  if (isCuSymbol(key) || isUnquote(key)) {
    return key;
  }
  return new ParseError(
    `key of an object without a value must be a Symbol, but ${key.t} at line ${key.l}, column ${key.c}`,
  );
}

function string(token: MatchedToken): LiteralString<Location> | ParseError {
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
  return {
    t: "String",
    v: JSON.parse(stringLiteral) as string,
    l,
    c,
    f,
  };
}

function number(
  token: MatchedToken,
): LiteralInteger32<Location> | LiteralFloat64<Location> {
  const { l, c, f } = token;
  const m = token.v;

  if (m.groups?.fractional === undefined) {
    const v = parseInt(m[0]);
    return {
      t: "Integer32",
      v,
      l,
      c,
      f,
    };
  }

  const v = parseFloat(m[0]);
  return {
    t: "Float64",
    v,
    l,
    c,
    f,
  };
}

function symbolOrPropertyAccess(
  token: MatchedToken,
):
  | LiteralCuSymbol<Location>
  | ReservedSymbol<Location>
  | LiteralPropertyAccess<Location>
  | ParseError {
  const { l, c, f } = token;
  const v = token.v[0];
  switch (v) {
    case "true":
      return {
        t: "ReservedSymbol",
        v: true,
        l,
        c,
        f,
      };
    case "false":
      return {
        t: "ReservedSymbol",
        v: false,
        l,
        c,
        f,
      };
    case "none":
      return {
        t: "ReservedSymbol",
        v: null,
        l,
        c,
        f,
      };
    default: {
      // TODO: Insufficient validation
      const parts = v.split(".");
      if (parts.length === 0) {
        return new ParseError(
          `Invalid symbol or property access: ${v} at line ${l}, column ${c}`,
        );
      }
      if (parts.length > 1) {
        return {
          t: "PropertyAccess",
          v: parts,
          l,
          c,
          f,
        };
      }
      return {
        t: "Symbol",
        v,
        l,
        c,
        f,
      };
    }
  }
}

function unquote(
  s: SpaceSkippingScanner,
  l: Location,
): Form<Location> | ParseError {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "$"
  const v = form(s);
  if (ParseError.is(v)) {
    return v;
  }
  return {
    t: "Unquote",
    v,
    ...l,
  };
}

function splice(
  s: SpaceSkippingScanner,
  l: Location,
): Form<Location> | ParseError {
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop "..."
  const v = form(s);
  if (ParseError.is(v)) {
    return v;
  }
  return {
    t: "Splice",
    v,
    ...l,
  };
}
