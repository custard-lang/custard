import { form, ParseError, buildTokenRegex } from "./grammar";
import { Scanner } from "./scanner";
import { Form } from "./types";

export function readStr(input: string): Form | ParseError {
  const s = new Scanner(buildTokenRegex(), input);
  return form(s);
}
