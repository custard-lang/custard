import type { Scanner } from "./scanner.js";
import {
  Form,
  CuArray,
  Atom,
  KeyValues,
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
  if (v instanceof ParseError) {
    return v;
  }
  return {
    t: "LiteralArray",
    v,
  };
}

function object(s: Scanner): KeyValues | ParseError {
  const v = untilClose(s, "}", keyValueOrSymbol);
  if (v instanceof ParseError) {
    return v;
  }
  return {
    t: "KeyValues",
    v,
  };
}

function keyValueOrSymbol(s: Scanner): KeyValue | CuSymbol | ParseError {
  const key = form(s);
  if (key instanceof ParseError) {
    return key;
  }
  if (s.peek() === ":") {
    // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
    s.next(); // drop colon
    const value = form(s);
    if (value instanceof ParseError) {
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
    if (f instanceof ParseError) {
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
