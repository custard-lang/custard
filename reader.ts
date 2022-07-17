import { form, ParseError, buildTokenRegex } from "./grammar.js";
import { Scanner } from "./scanner.js";
import { Form } from "./types.js";

export function readStr(input: string): Form | ParseError {
  const s = new Scanner(buildTokenRegex(), input);
  return form(s);
}
