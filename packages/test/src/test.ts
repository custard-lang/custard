import { test, expect } from "vitest";

import { assertNonError } from "@custard-lang/processor/dist/util/error.js";
import type { Awaitable } from "@custard-lang/processor/dist/util/types.js";

import { readBlock, readStr } from "@custard-lang/processor/dist/reader.js";
import { evalBlock, evalForm } from "@custard-lang/processor/dist/eval.js";
import { initializeForRepl } from "@custard-lang/processor/dist/env.js";
import {
  Block,
  Form,
  CompleteProvidedSymbolsConfig,
  TranspileOptions,
} from "@custard-lang/processor/dist/types.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */

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
    const result = await evalForm(assertNonError(readStr({ contents: src, path: "test" }) as Form), env);
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

export type Config = {
  options: TranspileOptions;
  providedSymbols: CompleteProvidedSymbolsConfig;
};
