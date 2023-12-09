import { describe, expect, test } from "vitest";

import { assertNonError } from "../../util/error";

import * as EnvF from "../env";
import * as ProvidedSymbolsConfigF from "../../provided-symbols-config.js";
import { readBlock } from "../../reader";
import { transpileBlock } from "../transpile";
import { transpileModule } from "../transpile-state";
import {
  Block,
  cuSymbol,
  Env,
  isNamespace,
  JsSrc,
  ModulePaths,
  TranspileError,
} from "../types";
import { fileOfImportMetaUrl } from "../../util/path";
import { standardModuleRoot } from "../definitions";

describe("transpileBlock", () => {
  const subject = async (
    src: string,
  ): Promise<[JsSrc | TranspileError, Env]> => {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    modulePaths.set("a", "../../../test-assets/a.mjs");
    modulePaths.set("sameDir", "./same-dir.js");
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
    const env = EnvF.init(transpileModule({ srcPath }), {
      from: srcPath,
      ...providedSymbolsConfig,
    });
    const jsSrc = await transpileBlock(
      assertNonError(readBlock(src)) as Block,
      env,
    );
    return [jsSrc, env];
  };

  describe("(import id)", () => {
    describe("given an id registered in the ModulePaths", () => {
      test("adds identifiers in the module, and returns an import for a relative path to the module", async () => {
        const [jsMod, env] = await subject("(import a)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual(
          'import * as a from "../../../test-assets/a.mjs";',
        );
        expect(EnvF.find(env, cuSymbol("a"))).toSatisfy(isNamespace);
      });

      test("adds identifiers in the module, and returns an import for a relative path to the module at the same directory", async () => {
        const [jsMod, env] = await subject("(import sameDir)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual(
          'import * as sameDir from "./same-dir.js";',
        );
        expect(EnvF.find(env, cuSymbol("sameDir"))).toSatisfy(isNamespace);
      });

      test("adds identifiers in the module, and returns an import for a node library in node_modules", async () => {
        const [jsMod, env] = await subject("(import typescript)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual(
          'import * as typescript from "../../../node_modules/typescript/lib/typescript.js";',
        );
        expect(EnvF.find(env, cuSymbol("typescript"))).toSatisfy(isNamespace);
      });

      test("adds identifiers in the module, and returns an import for a node built-in library", async () => {
        const [jsMod, env] = await subject("(import fs)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual('import * as fs from "node:fs/promises";');
        expect(EnvF.find(env, cuSymbol("fs"))).toSatisfy(isNamespace);
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
        expect(EnvF.find(env, cuSymbol("a"))).toBeUndefined();
      });
    });
  });

  describe("export id or declarations", () => {
    test("can export several from const/let declarations", async () => {
      const [jsMod, _env] = await subject(
        "(importAnyOf base)(export (const a 1) (const b 2) (let c 3))",
      );
      const src = assertNonError(jsMod) as JsSrc;
      const imports =
        'import{array, standardModuleRoot, string}from"../../../dist/src/lib/base.js";\n;\n';
      expect(src.trim()).toEqual(
        `${imports}export const a=1;\nexport const b=2;\nexport let c=3;\n;`,
      );
    });

    test("returns an error if an export is not a const/let declaration", async () => {
      const [r, _env] = await subject(
        "(importAnyOf base)(export (fn () none))",
      );
      expect(r).toEqual(
        new TranspileError(
          "The arguments of `export` must be a const/let declaration.",
        ),
      );
    });

    test("returns an error if an export is not an exportable statement", async () => {
      const [r, _env] = await subject(
        "(importAnyOf base)(export (when true none))",
      );
      expect(r).toEqual(
        new TranspileError(
          "The arguments of `export` must be a const/let declaration.",
        ),
      );
    });

    test("returns an error if no declarations are provided", async () => {
      const [r, _env] = await subject("(export)");
      expect(r).toEqual(
        new TranspileError(
          "The number of arguments of `export` must be at least 1.",
        ),
      );
    });

    test("returns an error if used in a non-top-level", async () => {
      const [r, _env] = await subject(
        "(importAnyOf base)(fn () (export (const a 1)))",
      );
      expect(r).toEqual(
        new TranspileError("`export` must be used at the top level."),
      );
    });
  });
});
