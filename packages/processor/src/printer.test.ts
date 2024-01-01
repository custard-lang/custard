import { assertNonError } from "./util/error";

import { readStr } from "./reader";
import { prStr } from "./printer";
import { describe, expect, test } from "vitest";
import type { Form } from "./types";

describe("prStr", () => {
  test("`( + 2 (* 3 4) )`", () => {
    expect(prStr(assertNonError(readStr("( + 2 (* 3 4) )")) as Form)).toEqual(
      "[+, 2, [*, 3, 4]]",
    );
  });
});
