import { form, ParseError, buildTokenRegex } from "./grammar.js";
import { Scanner } from "./scanner.js";
import { Form } from "./types.js";

export function readStr(input: string): Form | ParseError {
  const s = new Scanner(buildTokenRegex(), input);
  const parsed = form(s);
  const left = s.next();
  if (left) {
    return new ParseError(`Unexpected token left!: ${JSON.stringify(left)}`);
  }
  return parsed;
}
