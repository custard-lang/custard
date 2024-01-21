import { describe, expect, test } from "vitest";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";

import { readStr } from "@custard-lang/processor/dist/reader.js";
import { prStr } from "@custard-lang/processor/dist/printer.js";
import type { Form } from "@custard-lang/processor/dist/types.js";

describe("prStr", () => {
  test("`( + 2 (* 3 4) )`", () => {
    expect(prStr(assertNonError(readStr("( + 2 (* 3 4) )")) as Form)).toEqual(
      "[+, 2, [*, 3, 4]]",
    );
  });
});
