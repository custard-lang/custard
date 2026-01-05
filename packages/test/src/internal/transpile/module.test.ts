import { describe, expect, test } from "vitest";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";

import * as ContextF from "@custard-lang/processor/dist/internal/context.js";
import * as ProvidedSymbolsConfigF from "@custard-lang/processor/dist/provided-symbols-config.js";
import { readBlock } from "@custard-lang/processor/dist/reader.js";
import { transpileBlock } from "@custard-lang/processor/dist/internal/transpile.js";
import { transpileModule } from "@custard-lang/processor/dist/internal/transpile-state.js";
import {
  type Context,
  isNamespace,
  type ModulePaths,
  type TranspileModule,
  readerInput,
  assumeIsFile,
  type Ktvals,
  isConst,
} from "@custard-lang/processor/dist/internal/types.js";
import {
  TranspileError,
  type Block,
  type JsSrc,
  cuSymbol,
  fromDefaultTranspileOptions,
} from "@custard-lang/processor/dist/types.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";
import { standardModuleRoot } from "@custard-lang/processor/dist/internal/definitions.js";
import { transpileKtvalsForModule } from "@custard-lang/processor/dist/internal/ktvals.js";
import { Config, testForm } from "../../helpers.js";

describe("transpileBlock", () => {
  const subject = async (
    contents: string,
  ): Promise<[JsSrc | TranspileError, Context]> => {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("base", `${standardModuleRoot}/base.js`);
    modulePaths.set("a", "../../../assets/a.mjs");
    modulePaths.set("sameDir", "./same-dir.js");
    modulePaths.set("typescript", "npm:typescript");
    modulePaths.set("fs", "node:fs/promises");
    const providedSymbolsConfig = ProvidedSymbolsConfigF.build({
      builtinModulePaths: [],
      otherModulePaths: modulePaths,
      implicitStatements: "",
      jsTopLevels: [],
    });
    const src = assumeIsFile(fileOfImportMetaUrl(import.meta.url));

    const inputBlock = assertNonError(
      readBlock(readerInput(src, contents)),
    ) as Block;
    const options = fromDefaultTranspileOptions({ src });
    const context = assertNonError(
      ContextF.init(transpileModule(options), providedSymbolsConfig, src),
    ) as Context<TranspileModule>;
    const jsSrc = await transpileBlock(inputBlock, context);
    if (TranspileError.is(jsSrc)) {
      return [jsSrc, context];
    }
    return [transpileKtvalsForModule(jsSrc, context), context];
  };

  describe("(import id)", () => {
    describe("given an id registered in the ModulePaths", () => {
      test("adds identifiers in the module, and returns an import for a relative path to the module", async () => {
        const [jsMod, context] = await subject("(import a)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual(
          'import * as a from "../../../assets/a.mjs";',
        );
        expect(ContextF.find(context, cuSymbol("a"))).toSatisfy(isNamespace);
      });

      test("adds identifiers in the module, and returns an import for a relative path to the module at the same directory", async () => {
        const [jsMod, context] = await subject("(import sameDir)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual('import * as sameDir from "./same-dir.js";');
        expect(ContextF.find(context, cuSymbol("sameDir"))).toSatisfy(
          isNamespace,
        );
      });

      test("adds identifiers in the module, and returns an import for a node library in node_modules", async () => {
        const [jsMod, context] = await subject("(import typescript)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual('import * as typescript from "typescript";');
        expect(ContextF.find(context, cuSymbol("typescript"))).toSatisfy(
          isNamespace,
        );
      });

      test("adds identifiers in the module, and returns an import for a node built-in library", async () => {
        const [jsMod, context] = await subject("(import fs)");
        const src = assertNonError(jsMod) as JsSrc;
        expect(src.trim()).toEqual('import * as fs from "node:fs/promises";');
        expect(ContextF.find(context, cuSymbol("fs"))).toSatisfy(isNamespace);
      });
    });

    describe("given an id NOT registered in the ModulePaths", () => {
      test("doesn't update the context, and returns an error", async () => {
        const [err, context] = await subject("(import nonExistent)");
        expect(err).toEqual(
          new TranspileError(
            "No module `nonExistent` registered in the Module Paths",
          ),
        );
        expect(ContextF.find(context, cuSymbol("a"))).toEqual(
          new TranspileError(
            "No variable `a` is defined! NOTE: If you want to define `a` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );
      });
    });
  });

  describe("export id or declarations", () => {
    test("can export several from const/let declarations", async () => {
      const [jsMod] = await subject(
        "(importAnyOf base)(export (const a 1) (const b 2) (let c 3))",
      );
      const src = assertNonError(jsMod) as JsSrc;
      const imports =
        'import{standardModuleRoot}from"@custard-lang/processor/dist/lib/base.js";\n;\n';
      expect(src.trim()).toEqual(
        `${imports}export const a=1;\nexport const b=2;\nexport let c=3;`,
      );
    });

    test("returns an error if an export is not a const/let declaration", async () => {
      const [r, _context] = await subject(
        "(importAnyOf base)(export (fn () none))",
      );
      expect(r).toEqual(
        new TranspileError(
          "The arguments of `export` must be an exportable declaration (e.g., `const`/`let`). But got `(List (Symbol fn) ...)`.",
        ),
      );
    });

    test("returns an error if an export is not an exportable statement", async () => {
      const [r, _context] = await subject(
        "(importAnyOf base)(export (if true none))",
      );
      expect(r).toEqual(
        new TranspileError(
          "The arguments of `export` must be an exportable declaration (e.g., `const`/`let`). But got `(List (Symbol if) ...)`.",
        ),
      );
    });

    test("returns an error if no declarations are provided", async () => {
      const [r, _context] = await subject("(export)");
      expect(r).toEqual(
        new TranspileError(
          "The number of arguments of `export` must be at least 1.",
        ),
      );
    });

    test("returns an error if used in a non-top-level", async () => {
      const [r, _context] = await subject(
        "(importAnyOf base)(fn () (export (const a 1)))",
      );
      expect(r).toEqual(
        new TranspileError("`export` must be used at the top level."),
      );
    });
  });
});

describe("evaluation of `import` and `export`", () => {
  function setUpConfig(): Config {
    const modulePaths: ModulePaths = new Map();
    modulePaths.set("a", "../../../assets/a.mjs");
    modulePaths.set("base", `${standardModuleRoot}//base.js`);
    const srcPath = fileOfImportMetaUrl(import.meta.url);
    return {
      optionsForRepl: fromDefaultTranspileOptions({
        src: assumeIsFile(srcPath),
      }),
      providedSymbols: {
        modulePaths,
        implicitStatements: "(importAnyOf base)",
        jsTopLevels: [],
      },
      providedSymbolsPath: srcPath,
    };
  }

  testForm({
    src: "(import a) a.a",
    expected: "Module A",
    setUpConfig,
  });

  testForm({
    src: "(export (const b 1) (const c (plusF b 1))) c",
    expected: 2,
    setUpConfig,
  });
});

describe("when runtimeModuleEmission is 'none'", () => {
  const subject = async (contents: string): Promise<[JsSrc, Context]> => {
    const src = assumeIsFile(fileOfImportMetaUrl(import.meta.url));
    const options = {
      src,
      runtimeModuleEmission: "none" as const,
    };

    const modulePaths: ModulePaths = new Map();
    modulePaths.set("fs", "node:fs/promises");
    modulePaths.set("base", `${standardModuleRoot}//base.js`);
    const providedSymbolsConfig = ProvidedSymbolsConfigF.build({
      builtinModulePaths: [],
      otherModulePaths: modulePaths,
      implicitStatements: "",
      jsTopLevels: [],
    });

    const inputBlock = assertNonError(
      readBlock(readerInput(src, contents)),
    ) as Block;
    const context = assertNonError(
      ContextF.init(transpileModule(options), providedSymbolsConfig, src),
    ) as Context<TranspileModule>;
    const jsSrc = await transpileBlock(inputBlock, context);
    const jsMod = transpileKtvalsForModule(jsSrc as Ktvals<JsSrc>, context);
    return [jsMod, context];
  };

  describe("(import id)", () => {
    test('adds identifiers in the module, and returns no import when runtimeModuleEmission is "none"', async () => {
      const [jsMod, context] = await subject("(import fs)");
      expect(jsMod.trim()).toEqual("");
      expect(ContextF.find(context, cuSymbol("fs"))).toSatisfy(isNamespace);
    });
  });

  describe("(importAnyOf id)", () => {
    test('adds identifiers in the module, and returns no import when runtimeModuleEmission is "none"', async () => {
      const [jsMod, context] = await subject("(importAnyOf base)");
      expect(jsMod.trim()).toEqual("");
      expect(ContextF.find(context, cuSymbol("standardModuleRoot"))).toSatisfy(
        isConst,
      );
    });
  });
});
