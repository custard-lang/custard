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
  transpileOptionsFromPath,
} from "../types";
import { fileOfImportMetaUrl } from "../../util/path";

describe("transpileBlock", () => {
  const subject = async (
    src: string,
  ): Promise<[JsSrc | TranspileError, Env]> => {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "../../../test-assets/a.mjs");
    modulePaths.set(
      "typescript",
      "../../../node_modules/typescript/lib/typescript.js",
    );
    modulePaths.set("fs", "node:fs/promises");
    const providedSymbolsConfig = ProvidedSymbolsConfigF.build({
      builtinModulePaths: [],
      otherModulePaths: modulePaths,
      implicitStatements: "",
      jsTopLevels: [],
    });

    const srcPath = fileOfImportMetaUrl(import.meta.url);
    const env = EnvF.init(
      transpileModule(await transpileOptionsFromPath(srcPath)),
      {
        from: srcPath,
        ...providedSymbolsConfig,
      },
    );
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
        expect(src.trim()).toEqual(
          'import * as typescript from "../../../node_modules/typescript/lib/typescript.js";',
        );
        expect(EnvF.find(env, "typescript")).toSatisfy(isNamespace);
      });

      test("adds identifiers in the module, and returns an import for a node library in Node.js", async () => {
        const [jsMod, env] = await subject("(import fs)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual('import * as fs from "node:fs/promises";');
        expect(EnvF.find(env, "fs")).toSatisfy(isNamespace);
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
