import { Form } from "./types";

export function prStr(form: Form): string {
  if (form instanceof Array) {
    return `[${form.map((x) => prStr(x)).join(", ")}]`;
  }
  switch (form) {
    case true:
      return "true";
    case false:
      return "false";
    case undefined:
      return "undefined";
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
    case "PropertyAccess":
      return form.v.join(".");
    case "KeyValues":
      // TODO
      throw new Error("KeyValues not yet implemented");
  }
}
