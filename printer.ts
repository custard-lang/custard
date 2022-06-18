import { Form } from "./types";

export function prStr(form: Form): string {
  if (form instanceof Array) {
    return `[${form.map((x) => prStr(x)).join(", ")}]`;
  }
  switch (form) {
    case true:
      return "True";
    case false:
      return "False";
    case undefined:
      return "None";
  }
  switch (typeof form) {
    case "number":
      return form.toString();
    case "string":
      return JSON.stringify(form);
  }
  switch (form.t) {
    case "Integer32":
      return form.v.toString();
    case "Symbol":
      return form.v;
  }
}
