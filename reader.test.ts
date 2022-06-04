import { readStr } from "./reader";
import { describe, expect, test } from "vitest";

describe("parse", () => {
  test("`123` -> `123`", () => {
    expect(readStr("123")).toEqual({ t: "Integer", v: "123" });
  });
  test("`123 ` -> `123`", () => {
    expect(readStr("123 ")).toEqual({ t: "Integer", v: "123" });
  });
  test("`abc` -> `abc`", () => {
    expect(readStr("abc")).toEqual({ t: "Symbol", v: "abc" });
  });
  test("`abc ` -> `abc`", () => {
    expect(readStr("abc ")).toEqual({ t: "Symbol", v: "abc" });
  });
  test("`(123 456)` -> `(123 456)`", () => {
    expect(readStr("(123 456)")).toEqual([
      { t: "Integer", v: "123" },
      { t: "Integer", v: "456" },
    ]);
  });
  test("`( 123 456 789 )` -> `(123 456 789)`", () => {
    expect(readStr("(123 456 789)")).toEqual([
      { t: "Integer", v: "123" },
      { t: "Integer", v: "456" },
      { t: "Integer", v: "789" },
    ]);
  });
  test("`( + 2 (* 3 4) )` -> `(+ 2 (* 3 4))`", () => {
    expect(readStr("( + 2 (* 3 4) )")).toEqual([
      { t: "Symbol", v: "+" },
      { t: "Integer", v: "2" },
      [
        { t: "Symbol", v: "*" },
        { t: "Integer", v: "3" },
        { t: "Integer", v: "4" },
      ],
    ]);
  });
});
