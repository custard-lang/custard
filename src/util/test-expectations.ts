import { test, expect } from "vitest";

import { assertNonError } from "./error";

import { Repl, ReplOptions } from "../repl";
import { readBlock, readStr } from "../reader";
import { evalBlock, evalForm } from "../eval";

export function testEvalFormOf({
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
  setUpReplOptions: () => Promise<ReplOptions>;
  
}): void {

  const t = only ? test.only : test;
  t(`\`${src}\` => ${expected}`, async () => {
    await Repl.using(
      await setUpReplOptions(),
      async (repl) => {
        if (preludeSrc) {
          assertNonError(await evalForm(assertNonError(readStr(preludeSrc)), repl));
        }
        const result = await evalForm(assertNonError(readStr(src)), repl);
        if (!(expected instanceof Error) && result instanceof Error) {
          throw result;
        }
        expect(result).toEqual(expected);
      },
    );
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
  setUpReplOptions: () => Promise<ReplOptions>;
}): void {
  const t = only ? test.only : test;
  t(`\`${src}\` => ${expected}`, async () => {
    await Repl.using(
      await setUpReplOptions(),
      async (repl) => {
        if (preludeSrc) {
          assertNonError(await evalForm(assertNonError(readStr(preludeSrc)), repl));
        }
        const result = await evalBlock(assertNonError(readBlock(src)), repl);
        if (!(expected instanceof Error) && result instanceof Error) {
          throw result;
        }
        expect(result).toEqual(expected);
      },
    );
  });
}
