import type { Scanner } from "./scanner.js";
import {
  Form,
  CuArray,
  Atom,
  LiteralObject,
  KeyValue,
  CuSymbol,
  isCuSymbol,
  LiteralArray,
} from "./types.js";

// const tokenRegex = /[\s,]*(~@|[\[\]{}()'`~^@]|"(?:\\.|[^\\"])*"?|;.*|[^\s\[\]{}('"`,;)]*)/;

const ignored = "[\\s,]*";

const specialSingle = "[\\[\\]{}()'`~^@:]";

const doubleQuoted = '"(?:\\\\.|[^\\\\"])*"?';
const doubleQuotedRe = new RegExp(doubleQuoted);

// TODO: symbolに変えて、JSのidentifierと同等に
const nonSpecial = "[^\\s\\[\\]{}('\"`,;:)]*";

export function buildTokenRegex(): RegExp {
  return new RegExp(
    `${ignored}(${[specialSingle, doubleQuoted, nonSpecial].join("|")})`,
    "g",
  );
}

export class ParseError extends Error {
  override name = "ParseError";

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isParseError = true;
  static is(e: unknown): e is ParseError {
    return (e as Record<string, unknown>)?._cu$isParseError === true;
  }
}

export function form(s: Scanner): Form | ParseError {
  switch (s.peek()) {
    case "(":
      return list(s);
    case "[":
      return literalArray(s);
    case "{":
      return object(s);
    default:
      return atom(s);
  }
}

function list(s: Scanner): CuArray | ParseError {
  return untilClose(s, ")", form);
}

function literalArray(s: Scanner): LiteralArray | ParseError {
  const v = untilClose(s, "]", form);
  if (ParseError.is(v)) {
    return v;
  }
  return {
    t: "LiteralArray",
    v,
  };
}

function object(s: Scanner): LiteralObject | ParseError {
  const v = untilClose(s, "}", keyValueOrSymbol);
  if (ParseError.is(v)) {
    return v;
  }
  return {
    t: "LiteralObject",
    v,
  };
}

function keyValueOrSymbol(s: Scanner): KeyValue | CuSymbol | ParseError {
  const key = form(s);
  if (ParseError.is(key)) {
    return key;
  }
  if (s.peek() === ":") {
    // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
    s.next(); // drop colon
    const value = form(s);
    if (ParseError.is(value)) {
      return value;
    }
    return [key, value];
  }
  if (isCuSymbol(key)) {
    return key;
  }
  return new ParseError(
    `key of an object without a value must be a symbol, but ${JSON.stringify(
      key,
    )}`,
  );
}

function untilClose<Result>(
  s: Scanner,
  close: string,
  symbol: (s: Scanner) => Result | ParseError,
): Result[] | ParseError {
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop open paren

  const result: Result[] = [];
  while (true) {
    const next = s.peek();
    if (next === close) {
      break;
    }
    const f = symbol(s);
    if (ParseError.is(f)) {
      return f;
    }
    result.push(f);
  }
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  s.next(); // drop close paren
  return result;
}

function atom(s: Scanner): Atom | ParseError {
  const token = s.next();
  if (!token) {
    return new ParseError("Unexpected end of input!");
  }
  if (doubleQuotedRe.test(token)) {
    return token
      .slice(1, token.length - 1)
      .replace(/\\(.)/g, (_, c: string) => (c == "n" ? "\n" : c));
  }
  const md = /^-?[0-9]+(\.[0-9]+)?$/.exec(token);
  if (md) {
    if (md[1]) {
      return Number(md[0]);
    }
    return {
      t: "Integer32",
      v: Number(md[0]) | 0,
    };
  }
  switch (token) {
    case "true":
      return true;
    case "false":
      return false;
    case "undefined":
      return undefined;
    default:
      // TODO: Tokenize the period character.
      if (token.includes(".")) {
        return {
          t: "PropertyAccess",
          v: token.split("."),
        };
      }
      return {
        t: "Symbol",
        v: token,
      };
  }
}
