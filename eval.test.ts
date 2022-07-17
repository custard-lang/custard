import { assertNonError } from "./util/error";

import { readStr } from "./reader";
import { evalAst, initialEnv } from "./eval";
import { describe, expect, test } from "vitest";

describe("evalAst", () => {
  test("`( addF 2.0 (mulF 3.0 4.0) )`", () => {
    expect(
      evalAst(
        assertNonError(readStr("( addF 2.0 (mulF 3.0 4.0) ))")),
        initialEnv
      )
    ).toEqual(14);
  });
});
