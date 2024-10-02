import { test, expect } from "vitest";
import { equals, type Tester } from "@vitest/expect";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";
import type { Awaitable } from "@custard-lang/processor/dist/util/types.js";

import { readBlock } from "@custard-lang/processor/dist/reader.js";
import { evalBlock } from "@custard-lang/processor/dist/eval.js";
import {
  type Block,
  type CompleteProvidedSymbolsConfig,
  type TranspileOptions,
  isInteger32,
  type Integer32,
  type Float64,
  type CuString,
  isFloat64,
  isCuString,
} from "@custard-lang/processor/dist/types.js";
import { initializeForRepl, transpileModule } from "@custard-lang/processor";
import { withNewPath } from "./helpers/tmp-file.js";
import { writeAndEval } from "./helpers/eval.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */

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

// TODO: Unify into `testForm`
export function testEvalFormOf({
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
    const { optionsForRepl: options, providedSymbols } = await setUpConfig();
    const env = assertNonError(
      await initializeForRepl(options, providedSymbols),
    );
    const result = await evalBlock(
      assertNonError(readBlock({ contents: src, path: "test" })) as Block,
      env,
    );
    if (!(expected instanceof Error) && result instanceof Error) {
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
    const { providedSymbols } = await setUpConfig();
    await withNewPath(async ({ src: srcPath, dest }) => {
      const jsSrc = await transpileModule(
        assertNonError(readBlock({ contents: src, path: srcPath })) as Block,
        { srcPath },
        providedSymbols,
        { mayHaveResult: true },
      );
      if (expected instanceof Error) {
        expect(jsSrc).toEqual(expected);
        return;
      }

      const result = await writeAndEval(dest, assertNonError(jsSrc));
      expect(result).toEqual(expected);
    });
  });
}

// TODO: Unify into `testForm`
export const testEvalBlockOf = testEvalFormOf;

export interface Config {
  optionsForRepl: TranspileOptions;
  providedSymbols: CompleteProvidedSymbolsConfig;
}
