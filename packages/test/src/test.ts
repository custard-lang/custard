import { test, expect } from "vitest";
import { equals, type Tester } from "@vitest/expect";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";
import type { Awaitable } from "@custard-lang/processor/dist/util/types.js";

import { readBlock, readStr } from "@custard-lang/processor/dist/reader.js";
import { evalBlock, evalForm } from "@custard-lang/processor/dist/eval.js";
import { initializeForRepl } from "@custard-lang/processor/dist/env.js";
import {
  type Block,
  type Form,
  type CompleteProvidedSymbolsConfig,
  type TranspileOptions,
  isInteger32,
  Integer32,
  Float64,
  CuString,
  isFloat64,
  isCuString,
} from "@custard-lang/processor/dist/types.js";

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

export function testEvalFormOf({
  src,
  expected,
  only,
  setUpConfig,
}: {
  src: string;
  expected: any;
  only?: true | undefined;
  setUpConfig: () => Awaitable<Config>;
}): void {
  const t = only ? test.only : test;
  t(`\`${src}\` => ${JSON.stringify(expected)}`, async () => {
    const c = setUpConfig();
    const { options, providedSymbols } = c instanceof Promise ? await c : c;
    const env = assertNonError(
      await initializeForRepl(options, providedSymbols),
    );
    const result = await evalForm(
      assertNonError(readStr({ contents: src, path: "test" }) as Form),
      env,
    );
    if (!(expected instanceof Error) && result instanceof Error) {
      throw result;
    }
    expect(result).toEqual(expected);
  });
}

export function testEvalBlockOf({
  src,
  expected,
  only,
  setUpConfig,
}: {
  src: string;
  expected: any;
  only?: true | undefined;
  setUpConfig: () => Awaitable<Config>;
}): void {
  const t = only ? test.only : test;
  t(`\`${src}\` => ${JSON.stringify(expected)}`, async () => {
    const c = setUpConfig();
    const { options, providedSymbols } = c instanceof Promise ? await c : c;
    const env = assertNonError(
      await initializeForRepl(options, providedSymbols),
    );
    const result = await evalBlock(
      assertNonError(readBlock({ contents: src, path: "test" }) as Block),
      env,
    );
    if (!(expected instanceof Error) && result instanceof Error) {
      throw result;
    }
    expect(result).toEqual(expected);
  });
}

export interface Config {
  options: TranspileOptions;
  providedSymbols: CompleteProvidedSymbolsConfig;
}
