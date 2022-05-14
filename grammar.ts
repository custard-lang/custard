import type { Scanner } from "./scanner";
import type { Value, List, Atom } from "./types";

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

export function form(s: Scanner): Value | ParseError {
  const token = s.next();
  if (token === "(") {
    return list(s);
  }
  return atom(s);
}

function list(s: Scanner): List | ParseError {
  throw new Error("Function not implemented.");
}

function atom(s: Scanner): Atom | ParseError {
  throw new Error("Function not implemented.");
}
