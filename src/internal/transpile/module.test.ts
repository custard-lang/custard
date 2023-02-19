import { describe, expect, test } from "vitest";

import { assertNonError } from "../../util/error";

import * as EnvF from "../env";
import { readBlock } from "../../reader";
import { transpileBlock } from "../transpile";
import { transpileModule } from "../transpile-state";
import { Env } from "../types";
import { isConst, JsSrc, ModulePaths, TranspileError } from "../../types";
import { loadAsScope, standardRoot } from "../../module";

describe("transpileBlock", () => {
  const subject = async (
    src: string,
  ): Promise<[JsSrc | TranspileError, Env]> => {
    const modules: ModulePaths = new Map();
    modules.set("a", "../../../test-assets/a.mjs");

    const env = EnvF.init(
      await loadAsScope([`${standardRoot}/base.js`]),
      await transpileModule({ srcPath: __filename }),
      modules,
    );
    const jsSrc = await transpileBlock(assertNonError(readBlock(src)), env);
    return [jsSrc, env];
  };

  describe("(import id)", () => {
    describe("given an id registered in the ModulePaths", () => {
      test("adds identifiers in the module, and returns imports in JavaScript", async () => {
        const [jsSrc, env] = await subject("(import a)");
        expect(assertNonError(jsSrc).trim()).toEqual(
          'import * as a from "../../../test-assets/a.mjs";',
        );
        expect(EnvF.find(env, "a")).toSatisfy(isConst);
      });
    });

    describe("given an id NOT registered in the ModulePaths", () => {
      test("doesn't update the env, and returns an error", async () => {
        const [err, env] = await subject("(import nonExistent)");
        expect(err).toEqual(
          new TranspileError(
            "No module `nonExistent` registered in the Module Paths",
          ),
        );
        expect(EnvF.find(env, "a")).toBeUndefined();
      });
    });
  });
});
