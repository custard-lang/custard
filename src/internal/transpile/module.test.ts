import { describe, expect, test } from "vitest";

import { assertNonError } from "../../util/error";

import * as EnvF from "../env";
import { readBlock } from "../../reader";
import { transpileBlock } from "../transpile";
import { transpileModule } from "../transpile-state";
import { fromDefinitions } from "../scope";
import { Env } from "../types";
import { isNamespace, JsSrc, ModulePaths, TranspileError } from "../../internal/types";
import { loadModulePaths, standardModuleRoot } from "../../internal/definitions";

describe("transpileBlock", () => {
  const subject = async (
    src: string,
  ): Promise<[JsSrc | TranspileError, Env]> => {
    const modules: ModulePaths = new Map();
    modules.set("a", "../../../test-assets/a.mjs");

    const env = EnvF.init(
      fromDefinitions(await loadModulePaths([`${standardModuleRoot}/base.js`])),
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
        expect(EnvF.find(env, "a")).toSatisfy(isNamespace);
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
