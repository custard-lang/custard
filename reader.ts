import { form, ParseError, tokenRegex } from "./grammar";
import { Scanner } from "./scanner";
import { Form } from "./types";

export function readStr(input: string): Form | ParseError {
  const s = new Scanner(tokenRegex, input);
  return form(s);
}
