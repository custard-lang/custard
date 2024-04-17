import { form, ParseError, tokens } from "./grammar.js";
import { SpaceSkippingScanner, EOF } from "./scanner.js";
import { Block, Form, ReaderInput, Location } from "./types.js";

export function readStr(input: ReaderInput): Form<Location> | ParseError {
  const s = new SpaceSkippingScanner(tokens, input);
  const parsed = form(s);
  if (ParseError.is(parsed)) {
    return parsed;
  }
  const left = s.next();
  if (left !== EOF) {
    return new ParseError(`Unexpected token left!: ${left.t}: "${left.v[0]}"`);
  }
  return parsed;
}

export function readBlock(input: ReaderInput): Block<Location> | ParseError {
  const s = new SpaceSkippingScanner(tokens, input);
  const result = [];
  let f: Form<Location> | ParseError;
  while (!s.isAtEof()) {
    f = form(s);
    if (ParseError.is(f)) {
      return f;
    }
    result.push(f);
  }
  return result;
}
