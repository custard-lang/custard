import { describe, expect, test } from "vitest";

import { assertNonError } from "../../util/error";

import * as EnvF from "../env";
import * as ProvidedSymbolsConfigF from "../../provided-symbols-config.js";
import { readBlock } from "../../reader";
import { transpileBlock } from "../transpile";
import { transpileModule } from "../transpile-state";
import {
  Block,
  Env,
  isNamespace,
  JsSrc,
  ModulePaths,
  TranspileError,
} from "../types";

describe("transpileBlock", () => {
  const subject = async (
    src: string,
  ): Promise<[JsSrc | TranspileError, Env]> => {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "../../../test-assets/a.mjs");
    modulePaths.set("typescript", "typescript");

    const env = EnvF.init(await transpileModule({ srcPath: __filename }), {
      ...ProvidedSymbolsConfigF.empty(),
      modulePaths,
    });
    const jsSrc = await transpileBlock(
      assertNonError(readBlock(src)) as Block,
      env,
    );
    return [jsSrc, env];
  };

  describe("(import id)", () => {
    describe("given an id registered in the ModulePaths", () => {
      test("adds identifiers in the module, and returns an import for a relative path in JavaScript", async () => {
        const [jsMod, env] = await subject("(import a)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual(
          'import * as a from "../../../test-assets/a.mjs";',
        );
        expect(EnvF.find(env, "a")).toSatisfy(isNamespace);
      });

      test("adds identifiers in the module, and returns an import for a node library in JavaScript", async () => {
        const [jsMod, env] = await subject("(import typescript)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual('import * as typescript from "typescript";');
        expect(EnvF.find(env, "typescript")).toSatisfy(isNamespace);
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
