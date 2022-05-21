import type { Scanner } from "./scanner";
import type { Form, List, Atom } from "./types";

// const tokenRegex = /[\s,]*(~@|[\[\]{}()'`~^@]|"(?:\\.|[^\\"])*"?|;.*|[^\s\[\]{}('"`,;)]*)/;

const ignored = "[\\s,]*";

const tildeAt = "~@";

const specialSingle = "[\\[\\]{}()'`~^@]";

const doubleQuoted = '"(?:\\\\.|[^\\\\"])*"?';

const comment = ";.*";

const nonSpecial = "[^\\s\\[\\]{}('\"`,;)]*";

export const tokenRegex = new RegExp(
  `${ignored}(${[
    tildeAt,
    specialSingle,
    doubleQuoted,
    comment,
    nonSpecial,
  ].join("|")})`,
  "g"
);

export type ParseError = undefined;

export function form(s: Scanner): Form | ParseError {
  const token = s.next();
  if (token === "(") {
    return list(s);
  }
  return atom(s);
}

function list(s: Scanner): List | ParseError {
  let token;
  const result = [];
  while ((token = s.next() === ")")) {
    if (token === undefined) {
      return undefined;
    }
    const f = form(s);
    if (f === undefined) {
      return undefined;
    }
    result.push(f);
  }
  return result;
}

function atom(s: Scanner): Atom | ParseError {
  const token = s.next();
  if (token === undefined) {
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
