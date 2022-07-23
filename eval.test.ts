import { assertNonError } from "./util/error";

import * as Env from "./env.js";
import { readStr } from "./reader";
import { evalAst, builtin } from "./eval";
import { describe, expect, test } from "vitest";

describe("evalAst", () => {
  test("`( addF 2.0 (mulF 3.0 4.0) )`", () => {
    expect(
      evalAst(
        assertNonError(readStr("( addF 2.0 (mulF 3.0 4.0) )")),
        Env.init(builtin)
      )
    ).toEqual(14);
  });
});
