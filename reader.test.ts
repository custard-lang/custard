import { readStr } from "./reader";
import { expect, test } from "vitest";

test("parse", () => {
  expect(readStr("1")).eq({ t: "Integer", v: "1" });
});
