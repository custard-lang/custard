import { test, expect } from "vitest";

import { assertNonError } from "./util/error";
import type { Awaitable } from "./util/types";

import { readBlock, readStr } from "./reader";
import { evalBlock, evalForm } from "./eval";
import { initializeForRepl } from "./env";
import {
  Block,
  Form,
  CompleteProvidedSymbolsConfig,
  TranspileOptions,
} from "./types";

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
  t(`\`${src}\` => ${expected}`, async () => {
    const c = setUpConfig();
    const { options, providedSymbols } = c instanceof Promise ? await c : c;
    const env = assertNonError(
      await initializeForRepl(options, providedSymbols),
    );
    const result = await evalForm(assertNonError(readStr(src) as Form), env);
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
  t(`\`${src}\` => ${expected}`, async () => {
    const c = setUpConfig();
    const { options, providedSymbols } = c instanceof Promise ? await c : c;
    const env = assertNonError(
      await initializeForRepl(options, providedSymbols),
    );
    const result = await evalBlock(
      assertNonError(readBlock(src) as Block),
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
