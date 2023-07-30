import { test, expect, Awaitable } from "vitest";

import { assertNonError } from "./util/error";

import { Repl, ReplOptions } from "./repl";
import { readBlock, readStr } from "./reader";
import { evalBlock, evalForm } from "./eval";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */

export function testEvalFormOf({
  src,
  preludeSrc,
  expected,
  only,
  setUpReplOptions,
}: {
  src: string;
  // TODO: Remove. Use implicitStatements of ProvidedSymbolsConfig instead
  preludeSrc?: string | undefined;
  expected: any;
  only?: true | undefined;
  setUpReplOptions: () => Awaitable<ReplOptions>;
}): void {
  const t = only ? test.only : test;
  t(`\`${src}\` => ${expected}`, async () => {
    await Repl.using(await setUpReplOptions(), async (repl) => {
      if (preludeSrc) {
        assertNonError(
          await evalBlock(assertNonError(readBlock(preludeSrc)), repl),
        );
      }
      const result = await evalForm(assertNonError(readStr(src)), repl);
      if (!(expected instanceof Error) && result instanceof Error) {
        throw result;
      }
      expect(result).toEqual(expected);
    });
  });
}

export function testEvalBlockOf({
  src,
  preludeSrc,
  expected,
  only,
  setUpReplOptions,
}: {
  src: string;
  preludeSrc?: string | undefined;
  expected: any;
  only?: true | undefined;
  setUpReplOptions: () => Awaitable<ReplOptions>;
}): void {
  const t = only ? test.only : test;
  t(`\`${src}\` => ${expected}`, async () => {
    await Repl.using(await setUpReplOptions(), async (repl) => {
      if (preludeSrc) {
        assertNonError(
          await evalBlock(assertNonError(readBlock(preludeSrc)), repl),
        );
      }
      const result = await evalBlock(assertNonError(readBlock(src)), repl);
      if (!(expected instanceof Error) && result instanceof Error) {
        throw result;
      }
      expect(result).toEqual(expected);
    });
  });
}
