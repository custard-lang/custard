import { assertNonError } from "../util/error";

import * as EnvF from "../env";
import { readBlock } from "../reader";
import { transpileBlock } from "../transpile";

import { describe, expect, test } from "vitest";
import { Env, JsSrc, ModulePaths, TranspileError } from "../types";
import { base } from "../lib/base";

describe("transpileBlock", () => {
  const subject = (src: string): [JsSrc | TranspileError, Env] => {
    const modules: ModulePaths = new Map();
    modules.set("a", "../../test-assets/a.js");

    const env = EnvF.init(base(), modules);
    const jsSrc = transpileBlock(assertNonError(readBlock(src)), env);
    return [jsSrc, env];
  };
  // TODO: importによってEnvが変化することと、JSでimportするコードが返ることをテスト
  describe("import", () => {
    test("adds identifiers in the module, and returns imports in JavaScript", () => {});
  });
});
