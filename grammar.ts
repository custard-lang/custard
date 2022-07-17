import type { Scanner } from "./scanner.js";
import type { Form, CuArray, Atom } from "./types.js";

// const tokenRegex = /[\s,]*(~@|[\[\]{}()'`~^@]|"(?:\\.|[^\\"])*"?|;.*|[^\s\[\]{}('"`,;)]*)/;

const ignored = "[\\s,]*";

const tildeAt = "~@";

const specialSingle = "[\\[\\]{}()'`~^@]";

const doubleQuoted = '"(?:\\\\.|[^\\\\"])*"?';
const doubleQuotedRe = new RegExp(doubleQuoted);

const comment = ";.*";

const nonSpecial = "[^\\s\\[\\]{}('\"`,;)]*";

export function buildTokenRegex(): RegExp {
  return new RegExp(
    `${ignored}(${[
      tildeAt,
      specialSingle,
      doubleQuoted,
      comment,
      nonSpecial,
    ].join("|")})`,
    "g"
  );
}

export class ParseError extends Error {
  override name = "ParseError";
}

export function form(s: Scanner): Form | ParseError {
  const token = s.peek();
  if (token === "(") {
    return list(s);
  }
  return atom(s);
}

function list(s: Scanner): CuArray | ParseError {
  const token = s.next(); // drop open paren
  if (token !== "(") {
    return new ParseError(`Expected an opening paren, but found ${JSON.stringify(token)}`);
  }
  const result: CuArray = [];
  while (true) {
    const next = s.peek();
    if (next === ")") {
      break;
    }
    const f = form(s);
    if (f instanceof ParseError) {
      return f;
    }
    result.push(f);
  }
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
    if (md[1]){
      return Number(md[0]);
    }
    return {
      t: "Integer32",
      v: Number(md[0]) | 0,
    };
  }
  switch(token){
    case "True":
      return true;
    case "False":
      return false;
    case "None":
      return undefined;
    default:
      return {
        t: "Symbol",
        v: token,
      };
  }
}
