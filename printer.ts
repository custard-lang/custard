import { Form } from "./types";

export function prStr(form: Form): string {
  if (form instanceof Array) {
    return `[${form.map((x) => prStr(x)).join(", ")}]`;
  }
  switch (form.t) {
    case "Integer":
    case "Symbol":
      return form.v;
  }
}
