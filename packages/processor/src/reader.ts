import {
  form,
  isParseError,
  ParseError,
  ParseErrorSkipping,
  tokens,
} from "./grammar.js";
import { isEof, SpaceSkippingScanner } from "./scanner.js";
import {
  type Block,
  type Form,
  type ReaderInput,
  type Location,
} from "./types.js";

export function readStr(
  input: ReaderInput,
): Form<Location> | ParseError<Form<Location>> {
  const s = new SpaceSkippingScanner(tokens, input);
  const parsed = form<Form<Location>>(s, (r) => r);
  if (isParseError(parsed)) {
    return parsed;
  }
  const left = s.next();
  if (!isEof(left)) {
    const { f, l, c } = left;
    return new ParseErrorSkipping(
      `Unexpected token left!: "${left.m[0]}" at line ${l}, column ${c} of ${f}`,
      left,
      () => parsed,
    );
  }
  return parsed;
}

export function readBlock(
  input: ReaderInput,
): Block<Location> | ParseError<Form<Location>> {
  const s = new SpaceSkippingScanner(tokens, input);
  const result = [];
  let f: Form<Location> | ParseError<Form<Location>>;
  while (!s.isAtEof()) {
    f = form(s, (r) => r);
    if (isParseError(f)) {
      return f;
    }
    result.push(f);
  }
  return result;
}

export function readResumably(
  input: ReaderInput,
): Form<Location> | ParseError<Form<Location>> {
  const s = new SpaceSkippingScanner(tokens, input);
  return form(s, (r) => r);
}
