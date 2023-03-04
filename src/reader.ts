import { form, ParseError, buildTokenRegex } from "./grammar.js";
import { Scanner } from "./scanner.js";
import { Block, Form } from "./types.js";

export function readStr(input: string): Form | ParseError {
  const s = new Scanner(buildTokenRegex(), input);
  const parsed = form(s);
  if (parsed instanceof ParseError) {
    return parsed;
  }
  const left = s.next();
  if (left) {
    return new ParseError(`Unexpected token left!: ${JSON.stringify(left)}`);
  }
  return parsed;
}

export function readBlock(input: string): Block | ParseError {
  const s = new Scanner(buildTokenRegex(), input);
  const result = [];
  let f: Form | ParseError;
  while (!s.isAtEof()) {
    f = form(s);
    if (f instanceof ParseError) {
      return f;
    }
    result.push(f);
  }
  return result;
}
