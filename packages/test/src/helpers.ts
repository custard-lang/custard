import { test, expect } from "vitest";
import { equals, type Tester } from "@vitest/expect";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";
import type { Awaitable } from "@custard-lang/processor/dist/util/types.js";

import { readBlock } from "@custard-lang/processor/dist/reader.js";
import { evalBlock } from "@custard-lang/processor/dist/eval.js";
import {
  type Block,
  type ProvidedSymbolsConfig,
  type TranspileOptions,
  type FilePath,
  isInteger32,
  type Integer32,
  type Float64,
  type CuString,
  isFloat64,
  isCuString,
  readerInput,
  assumeIsFile,
} from "@custard-lang/processor/dist/types.js";
import { ContextF, transpileModule } from "@custard-lang/processor";
import { withNewPath } from "./helpers/tmp-file.js";
import { writeAndEval } from "./helpers/eval.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

function primitiveFormsAreEqual(
  a: unknown,
  b: unknown,
  customTesters: Tester[],
): boolean | undefined {
  if (isInteger32(a)) {
    return isInteger32(b) && primitiveFormsAreEqualHelper(a, b, customTesters);
  }
  if (isFloat64(a)) {
    return isFloat64(b) && primitiveFormsAreEqualHelper(a, b, customTesters);
  }
  if (isCuString(a)) {
    return isCuString(b) && primitiveFormsAreEqualHelper(a, b, customTesters);
  }
  return undefined;
}
expect.addEqualityTesters([primitiveFormsAreEqual]);

function primitiveFormsAreEqualHelper(
  a: Integer32 | Float64 | CuString,
  b: Integer32 | Float64 | CuString,
  customTesters: Tester[],
): boolean {
  return (
    a.valueOf() === b.valueOf() &&
    equals(a.extension, b.extension, customTesters)
  );
}

export function testForm({
  src,
  expected,
  only,
  setUpConfig,
  fails,
}: {
  src: string;
  expected: any;
  only?: boolean | "inRepl" | "asModule";
  fails?: boolean | "inRepl" | "asModule";
  setUpConfig: () => Awaitable<Config>;
}): void {
  const inReplOptions = {
    src,
    expected,
    only: only === "inRepl" || only === true,
    fails: fails === "inRepl" || fails === true,
    setUpConfig,
  };
  const asModuleOptions = {
    src,
    expected,
    only: only === "asModule" || only === true,
    fails: fails === "asModule" || fails === true,
    setUpConfig,
  };
  testFormInRepl(inReplOptions);
  testFormAsModule(asModuleOptions);
}

export function testFormInRepl({
  src,
  expected,
  only,
  fails,
  setUpConfig,
}: {
  src: string;
  expected: any;
  only?: boolean;
  fails?: boolean;
  setUpConfig: () => Awaitable<Config>;
}): void {
  const t = fails ? test.fails : only ? test.only : test;
  t(`\`${src}\` =(evalBlock)=> ${JSON.stringify(expected)}`, async () => {
    const {
      optionsForRepl: options,
      providedSymbols,
      providedSymbolsPath,
    } = await setUpConfig();
    const context = assertNonError(
      await ContextF.initializeForRepl(
        options,
        providedSymbols,
        providedSymbolsPath,
      ),
    );
    const result = await evalBlock(
      assertNonError(
        readBlock(readerInput(assumeIsFile("test"), src)),
      ) as Block,
      context,
    );
    if (!(expected instanceof Error) && result instanceof Error) {
      if (result.cause instanceof Error) {
        throw result.cause;
      }
      throw result;
    }
    expect(result).toEqual(expected);
  });
}

export function testFormAsModule({
  src,
  expected,
  only,
  fails,
  setUpConfig,
}: {
  src: string;
  expected: any;
  only?: boolean;
  fails?: boolean;
  setUpConfig: () => Awaitable<Config>;
}): void {
  const t = fails ? test.fails : only ? test.only : test;
  t(`\`${src}\` =(transpileModule)=> ${JSON.stringify(expected)}`, async () => {
    const { providedSymbols, providedSymbolsPath } = await setUpConfig();
    await withNewPath(async ({ src: srcPath, dest }) => {
      const jsSrc = await transpileModule(
        assertNonError(readBlock(readerInput(srcPath, src))) as Block,
        { src: srcPath },
        providedSymbols,
        providedSymbolsPath,
        { mayHaveResult: true },
      );
      if (expected instanceof Error) {
        expect(jsSrc).toEqual(expected);
        return;
      }
      if (jsSrc instanceof Error) {
        if (jsSrc.cause instanceof Error) {
          throw jsSrc.cause;
        }
        throw jsSrc;
      }

      const result = await writeAndEval(dest, jsSrc);
      expect(result).toEqual(expected);
    });
  });
}

export interface Config {
  optionsForRepl: TranspileOptions;
  providedSymbols: ProvidedSymbolsConfig;
  providedSymbolsPath: FilePath;
}
