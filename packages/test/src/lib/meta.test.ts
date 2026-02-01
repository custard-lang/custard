import { describe, expect, test } from "vitest";

import * as fs from "node:fs/promises";

import {
  type Config,
  testForm,
  testFormAsModule,
  testFormInRepl,
} from "../helpers.js";
import { withNewPath } from "../helpers/tmp-file.js";
import { writeAndEval } from "../helpers/eval.js";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";

import {
  readerInput,
  assumeIsFile,
  normalizeFilePathAndStat,
  TranspileError,
  type Form,
  type ModulePaths,
  fromDefaultTranspileOptions,
  type Block,
} from "@custard-lang/processor/dist/types.js";
import { standardModuleRoot } from "@custard-lang/processor/dist/definitions.js";
import { evalForm } from "@custard-lang/processor/dist/eval.js";
import { readBlock, readStr } from "@custard-lang/processor/dist/reader.js";
import { initializeForRepl } from "@custard-lang/processor/dist/context.js";
import {
  dirOfImportMetaUrl,
  fileOfImportMetaUrl,
} from "@custard-lang/processor/dist/util/path.js";
// import * as meta causes an error vitest perhaps because `meta` conflicts
// with `(import meta)`.
import * as meta_ from "@custard-lang/processor/dist/lib/meta.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */

const srcPathAndStat = assumeIsFile(fileOfImportMetaUrl(import.meta.url));
function setUpConfig(): Config {
  const modulePaths: ModulePaths = new Map();
  modulePaths.set("base", `${standardModuleRoot}/base.js`);
  modulePaths.set("meta", `${standardModuleRoot}/meta.js`);
  modulePaths.set("async", `${standardModuleRoot}/async.js`);
  modulePaths.set("js", `${standardModuleRoot}/js.js`);

  return {
    optionsForRepl: fromDefaultTranspileOptions({ src: srcPathAndStat }),
    providedSymbols: {
      modulePaths,
      implicitStatements:
        "(importAnyOf base)(import meta)(import async)(import js)",
      jsTopLevels: ["Map"],
    },
    providedSymbolsPath: srcPathAndStat.path,
  };
}

describe("meta.readString", () => {
  const srcPathForErrorMessage = normalizeFilePathAndStat(srcPathAndStat);

  const contents1 = "(plusF 4.1 5.2)";
  testFormInRepl({
    src: `(meta.readString "${contents1}")`,
    expected: readBlock(readerInput(srcPathForErrorMessage, contents1)),
    setUpConfig,
  });

  const contents2 = "(const x 9.2) (plusF 4.1 5.2) (let y 0.1)";
  testFormInRepl({
    src: `(meta.readString "${contents2}")`,
    expected: readBlock(readerInput(srcPathForErrorMessage, contents2)),
    setUpConfig,
  });

  testFormAsModule({
    src: '(meta.readString "1")',
    expected: new TranspileError(
      "`meta.readString` is NOT currently available except in REPL or a macro definition.",
    ),
    setUpConfig,
  });
});

describe("meta.transpileModule", () => {
  const basePathJson = JSON.stringify(`${standardModuleRoot}/base.js`);
  const proviedSymbolsSrc = `{ modulePaths: (js.new Map [["base" ${basePathJson}]]) implicitStatements: "(importAnyOf base)" jsTopLevels: [] }`;
  const extraOptionsSrc = `{ mayHaveResult: true }`;
  const testPathAndStat = assumeIsFile("test");
  const toCstdSrc = (src: object): string => {
    return JSON.stringify(src).replace(/,/g, "");
  };

  test("transpiled source code can be `eval`ed as a JavaScript code 1.", async () => {
    const {
      optionsForRepl: options,
      providedSymbols,
      providedSymbolsPath: srcPath,
    } = setUpConfig();
    const context = assertNonError(
      await initializeForRepl(options, providedSymbols, srcPath),
    );

    await withNewPath(async ({ src, dest }) => {
      const transpileOptionsSrc = `{ src: ${toCstdSrc(src)} }`;
      const fromSrc = JSON.stringify(src.path);
      const input = readerInput(
        testPathAndStat,
        `(async.await (meta.transpileModule (meta.readString "(plusF 4.1 5.2)") ${transpileOptionsSrc} ${proviedSymbolsSrc} ${fromSrc} ${extraOptionsSrc}))`,
      );
      const result = assertNonError(
        await evalForm(assertNonError(readStr(input)) as Form, context),
      );
      expect(await writeAndEval(dest, result)).toEqual(4.1 + 5.2);
    });
  });

  test("transpiled source code can be `eval`ed as a JavaScript code 2.", async () => {
    const {
      optionsForRepl: options,
      providedSymbols,
      providedSymbolsPath: srcPath,
    } = setUpConfig();
    const context = assertNonError(
      await initializeForRepl(options, providedSymbols, srcPath),
    );

    await withNewPath(async ({ src, dest }) => {
      const transpileOptionsSrc = `{ src: ${toCstdSrc(src)} }`;
      const fromSrc = JSON.stringify(src.path);
      const input = readerInput(
        testPathAndStat,
        `(async.await (meta.transpileModule (async.await (meta.readString "(const x 9.2) (let y 0.1) (plusF x y)")) ${transpileOptionsSrc} ${proviedSymbolsSrc} ${fromSrc} ${extraOptionsSrc}))`,
      );
      const result = assertNonError(
        await evalForm(assertNonError(readStr(input)) as Form, context),
      );
      expect(await writeAndEval(dest, result)).toEqual(9.2 + 0.1);
    });
  });
});

describe("meta.evaluate", () => {
  testFormInRepl({
    src: '(meta.evaluate (async.await (meta.readString "(plusF 4.1 5.2)")))',
    expected: 4.1 + 5.2,
    setUpConfig,
  });

  testFormInRepl({
    src: '(meta.evaluate (meta.readString "(const x 9.2) (let y 0.1) (plusF x y)"))',
    expected: 9.2 + 0.1,
    setUpConfig,
  });

  testFormAsModule({
    src: "(meta.evaluate (meta.list))",
    expected: new TranspileError(
      "`meta.evaluate` is NOT currently available except in REPL or a macro definition.",
    ),
    setUpConfig,
  });
});

describe("meta.macro", () => {
  testForm({
    src: "(meta.macro (b f t) (meta.quasiQuote (andOr (not $b) $f else $t)))",
    expected: new TranspileError(
      "meta.macro needs a name of the macro as a symbol, but got `(List (Symbol b) ...)`",
    ),
    setUpConfig,
  });
  testForm({
    src: "(meta.macro unless (b f t) (meta.quasiQuote (andOr (not $b) $f $t))) (text (unless false 1 2) (unless true 1 2))",
    expected: "12",
    setUpConfig,
  });

  testForm({
    src: "(const c 999) (meta.macro getC () (meta.quasiQuote (plusF $c c))) (getC)",
    expected: 999 + 999,
    setUpConfig,
  });
  testForm({
    src: '((fn () (meta.macro doNothing () "do nothing") (doNothing)))',
    expected: new TranspileError("`meta.macro` must be used at the top level."),
    setUpConfig,
  });
  // TODO: Splice `let` and `const` declarations in macro to test hygine

  describe("macros are unavailable except for calling as a form.", () => {
    const macroDef =
      "(meta.macro unless (b f t) (meta.quasiQuote (andOr (not $b) $f $t)))";
    testForm({
      src: `${macroDef} unless`,
      expected: new TranspileError(
        "A macro `unless` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig,
    });
    testForm({
      src: `${macroDef} (const u unless)`,
      expected: new TranspileError(
        "A macro `unless` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig,
    });
    testForm({
      src: `${macroDef} (const arr [unless])`,
      expected: new TranspileError(
        "A macro `unless` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig,
    });
    testForm({
      src: `${macroDef} (fn callMacro (m b f t) (m b f t)) (callMacro unless false 1 2)`,
      expected: new TranspileError(
        "A macro `unless` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig,
    });
    testForm({
      src: `${macroDef} (const obj { m: unless })`,
      expected: new TranspileError(
        "A macro `unless` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig,
    });
    testForm({
      src: `${macroDef} (const obj { unless })`,
      expected: new TranspileError(
        "A macro `unless` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig,
    });
    testForm({
      // Other DirectWriter's argument
      src: `${macroDef} (plusF 1 unless)`,
      expected: new TranspileError(
        "A macro `unless` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig,
    });
  });

  describe("A macro defined and exported in an external module works correctly.", () => {
    async function setUpConfigWithMacroMod(): Promise<Config> {
      const srcPath = `${dirOfImportMetaUrl(import.meta.url)}/../../assets/macroMod.cstd`;
      const destPath = `${dirOfImportMetaUrl(import.meta.url)}/../../assets/macroMod.mjs`;

      const modulePaths: ModulePaths = new Map();
      modulePaths.set("base", `${standardModuleRoot}/base.js`);
      modulePaths.set("meta", `${standardModuleRoot}/meta.js`);
      modulePaths.set("macroMod", destPath);
      const providedSymbols = {
        modulePaths,
        implicitStatements: "(importAnyOf base)(import meta)",
        jsTopLevels: [],
      };
      const providedSymbolsPath = srcPathAndStat.path;

      const src = assumeIsFile(srcPath);
      const block = assertNonError(
        readBlock(readerInput(src, await fs.readFile(srcPath, "utf-8"))),
      ) as Block;
      const transpiled = assertNonError(
        await meta_.transpileModule(
          block,
          { src, runtimeModuleEmission: "import" },
          providedSymbols,
          providedSymbolsPath,
        ),
      );
      await fs.writeFile(destPath, transpiled, "utf-8");

      return {
        optionsForRepl: fromDefaultTranspileOptions({ src: srcPathAndStat }),
        providedSymbols,
        providedSymbolsPath,
      };
    }
    testForm({
      src: "(import macroMod)(let a 5)(macroMod.doubleMacro (meta.quote a)) a",
      expected: 10,
      setUpConfig: setUpConfigWithMacroMod,
    });

    testForm({
      src: `(import macroMod) (const u macroMod.doubleMacro)`,
      expected: new TranspileError(
        "A macro `macroMod.doubleMacro` cannot be assigned to a variable or passed as an argument.",
      ),
      setUpConfig: setUpConfigWithMacroMod,
    });
  });

  describe("when a macro updates an external variable, the execution results may differ between the REPL and the output module.", () => {
    const src =
      "(let count 0) (meta.macro inc () (incrementF count) count) (text (inc) (inc) count)";
    testFormInRepl({
      src,
      expected: "122",
      setUpConfig,
    });
    testFormAsModule({
      src,
      expected: "120",
      setUpConfig,
    });
  });
});

describe("meta.macroToFunction", () => {
  testForm({
    src: "(meta.macro unless (b f t) (meta.quasiQuote (andOr (not $b) $f $t))) ((meta.macroToFunction unless) false 1 2)",
    expected: meta_.list<any>(
      meta_.symbol("andOr"),
      meta_.list<any>(meta_.symbol("not"), false),
      1,
      2,
    ),
    setUpConfig,
  });
  testForm({
    src: "(let nonMacro (fn () none)) ((meta.macroToFunction nonMacro))",
    expected: new TranspileError(
      "The given id does not refer to a macro: `(Symbol nonMacro)`.",
    ),
    setUpConfig,
  });
});

describe("meta.quote", () => {
  testForm({
    src: "(const xs []) (const y 10) (meta.quote (plusF 4.1 $y ...$xs a.b.c))",
    expected: meta_.list<Form>(
      meta_.symbol("plusF"),
      meta_.float64(4.1),
      meta_.unquote(meta_.symbol("y")),
      meta_.splice(meta_.unquote(meta_.symbol("xs"))),
      meta_.propertyAccess("a", "b", "c"),
    ),
    setUpConfig,
  });
});

describe("meta.quasiQuote", () => {
  testForm({
    src: '(meta.quasiQuote ((const x 9.2)\n(let y (minusF 10 (timesF "3"))) [x\n(dividedByF) () [] { x: y y }] ))',
    expected: meta_.list<Form>(
      meta_.list<Form>(
        meta_.symbol("const"),
        meta_.symbol("x"),
        meta_.float64(9.2),
      ),
      meta_.list<Form>(
        meta_.symbol("let"),
        meta_.symbol("y"),
        meta_.list<Form>(
          meta_.symbol("minusF"),
          meta_.integer32(10),
          meta_.list<Form>(meta_.symbol("timesF"), meta_.string("3")),
        ),
      ),
      meta_.array<Form>(
        meta_.symbol("x"),
        meta_.list(meta_.symbol("dividedByF")),
        meta_.list(),
        meta_.array(),
        meta_.object<Form, Form, Form, Form>(
          meta_.keyValue<Form, Form, Form>(
            meta_.symbol("x"),
            meta_.symbol("y"),
          ),
          meta_.symbol("y"),
        ),
      ),
    ),
    setUpConfig,
  });

  testForm({
    src: `(let v1 (meta.symbol "varName"))(meta.quasiQuote ((const x $v1)\n(let y (minusF 10 (timesF $v1))) [x\n(dividedByF) [] { x: y $v1 }] ))`,
    expected: meta_.list<Form>(
      meta_.list(
        meta_.symbol("const"),
        meta_.symbol("x"),
        meta_.symbol("varName"),
      ),
      meta_.list<Form>(
        meta_.symbol("let"),
        meta_.symbol("y"),
        meta_.list<Form>(
          meta_.symbol("minusF"),
          meta_.integer32(10),
          meta_.list(meta_.symbol("timesF"), meta_.symbol("varName")),
        ),
      ),
      meta_.array<Form>(
        meta_.symbol("x"),
        meta_.list(meta_.symbol("dividedByF")),
        meta_.array(),
        meta_.object<Form, Form, Form, Form>(
          meta_.keyValue<Form, Form, Form>(
            meta_.symbol("x"),
            meta_.symbol("y"),
          ),
          meta_.symbol("varName"),
        ),
      ),
    ),
    setUpConfig,
  });

  testForm({
    src: '(const vars [(meta.symbol "varName") "varName2" 9 {}]) (meta.quasiQuote (const xs [12 ...$vars]))',
    expected: meta_.list<Form>(
      meta_.symbol("const"),
      meta_.symbol("xs"),
      meta_.array<any>(
        meta_.integer32(12),
        meta_.symbol("varName"),
        "varName2",
        9,
        {},
      ),
    ),
    setUpConfig,
  });
});
