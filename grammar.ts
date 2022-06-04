import type { Scanner } from "./scanner";
import type { Form, List, Atom } from "./types";

// const tokenRegex = /[\s,]*(~@|[\[\]{}()'`~^@]|"(?:\\.|[^\\"])*"?|;.*|[^\s\[\]{}('"`,;)]*)/;

const ignored = "[\\s,]*";

const tildeAt = "~@";

const specialSingle = "[\\[\\]{}()'`~^@]";

const doubleQuoted = '"(?:\\\\.|[^\\\\"])*"?';

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

export type ParseError = undefined;

export function form(s: Scanner): Form | ParseError {
  const token = s.peek();
  if (token === "(") {
    return list(s);
  }
  return atom(s);
}

function list(s: Scanner): List | ParseError {
  const token = s.next(); // drop open paren
  if (token !== "(") {
    return undefined;
  }
  const result: List = [];
  while (true) {
    const next = s.peek();
    if (next === ")") {
      break;
    }
    const f = form(s);
    if (f === undefined) {
      return undefined;
    }
    result.push(f);
  }
  s.next(); // drop close paren
  return result;
}

function atom(s: Scanner): Atom | ParseError {
  const token = s.next();
  if (!token) {
    return undefined;
  }
  if (/^-?[0-9]+$/.test(token)) {
    return {
      t: "Integer",
      v: token,
    };
  }
  return {
    t: "Symbol",
    v: token,
  };
}
