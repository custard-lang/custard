import { assertNonError } from "../util/error";

import * as EnvF from "../env";
import { readBlock } from "../reader";
import { transpileBlock } from "../transpile";

import { describe, expect, test } from "vitest";
import { Env, isConst, JsSrc, ModulePaths, TranspileError } from "../types";
import { base } from "../lib/base";

describe("transpileBlock", () => {
  const subject = (src: string): [JsSrc | TranspileError, Env] => {
    const modules: ModulePaths = new Map();
    modules.set("a", "../../test-assets/a.js");

    const env = EnvF.init(base(), modules);
    const jsSrc = transpileBlock(assertNonError(readBlock(src)), env);
    return [jsSrc, env];
  };

  describe("(import id)", () => {
    describe('given an id registered in the ModulePaths', () => {
      test("adds identifiers in the module, and returns imports in JavaScript", () => {
        const [jsSrc, env] = subject("(import a)");
        expect(assertNonError(jsSrc).trim()).toEqual('import * as a from "../../test-assets/a.js";');
        expect(EnvF.find(env, "a")).toSatisfy(isConst);
      });
    });

    describe('given an id NOT registered in the ModulePaths', () => {
      test("doesn't update the env, and returns an error", () => {
        const [err, env] = subject("(import nonExistent)");
        expect(err).toEqual(new TranspileError("No module `nonExistent` registered in the Module Paths"));
        expect(EnvF.find(env, "a")).toBeUndefined();
      });
    });
  });
});
