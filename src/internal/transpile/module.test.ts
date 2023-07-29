import { describe, expect, test } from "vitest";

import { assertNonError } from "../../util/error";

import * as EnvF from "../env";
import * as ProvidedSymbolsConfigF from "../../provided-symbols-config.js";
import { readBlock } from "../../reader";
import { transpileBlock } from "../transpile";
import { transpileModule } from "../transpile-state";
import { fromDefinitions } from "../scope";
import {
  Env,
  isNamespace,
  JsModule,
  ModulePaths,
  TranspileError,
} from "../types";
import {
  loadModulePaths,
  standardModuleRoot,
} from "../../internal/definitions";

describe("transpileBlock", () => {
  const subject = async (
    src: string,
  ): Promise<[JsModule | TranspileError, Env]> => {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "../../../test-assets/a.mjs");

    const env = EnvF.init(await transpileModule({ srcPath: __filename }), {
      ...ProvidedSymbolsConfigF.empty(),
      modulePaths,
    });
    const jsSrc = await transpileBlock(assertNonError(readBlock(src)), env);
    return [jsSrc, env];
  };

  describe("(import id)", () => {
    describe("given an id registered in the ModulePaths", () => {
      test("adds identifiers in the module, and returns imports in JavaScript", async () => {
        const [jsMod, env] = await subject("(import a)");
        const { imports, body, ...other } = assertNonError(jsMod);
        expect(assertNonError(imports).trim()).toEqual(
          'import * as a from "../../../test-assets/a.mjs";',
        );
        expect(assertNonError(body).trim().replace(/;/g, "")).toEqual("");
        expect(EnvF.find(env, "a")).toSatisfy(isNamespace);
        expect(other).toEqual({});
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
