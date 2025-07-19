#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  type Env,
  type Form,
  evalForm,
  standardModuleRoot,
  defaultTranspileOptions,
  type TranspileRepl,
  initializeForRepl,
  implicitlyImporting,
  readerInputOf,
  readResumably,
  isParseErrorSkipping,
  isParseErrorWantingMore,
  Location,
  replPromptPrefixOfNormalizedPath,
} from "@custard-lang/processor";

/* eslint-disable @typescript-eslint/no-explicit-any */

const rl = readline.createInterface({ input, output });

// EVAL
async function evalCustard(ast: Form, env: Env<TranspileRepl>): Promise<any> {
  return await evalForm(ast, env);
}

function finalize(): void {
  rl.close();
  input.destroy();
}

async function readEvaluatePrintLoop(
  env: Env<TranspileRepl>,
  location: Location,
): Promise<void> {
  try {
    while (true) {
      const answer = await ask(location, ">>>");
      if (answer === "") {
        finalize();
        break;
      }
      let form = readResumably(readerInputOf(env, answer, location.l));
      while (true) {
        if (isParseErrorSkipping(form)) {
          console.warn("ParseErrorSkipping", form.message);
          form = form.resume();
          continue;
        }
        if (isParseErrorWantingMore(form)) {
          setDownToNextLine(location);
          const more = await ask(location, "...");
          form = form.resume(more);
          continue;
        }
        break;
      }
      try {
        console.log(assertNonError(await evalCustard(form, env)));
      } catch (e) {
        console.error(e);
      }
      setDownToNextLine(location);
    }
  } catch (err) {
    finalize();
    throw err;
  }
}

function setDownToNextLine(location: Location): void {
  // The next position in the prompt should be
  // the beginning of the next line
  location.l++;
  location.c = 1; // Currently, the prompt doesn't show the column number, though.
}

async function ask({ l, f }: Location, promptPrefix: string): Promise<string> {
  return await rl.question(`${f}:${l}:${promptPrefix} `);
}

export function assertNonError<T>(v: T | Error): T {
  if (v instanceof Error) {
    throw v;
  }
  return v;
}

(async () => {
  const cwd = process.cwd();
  const env = assertNonError(
    await initializeForRepl(defaultTranspileOptions(), {
      from: cwd,
      ...implicitlyImporting(`${standardModuleRoot}/base.js`),
    }),
  );
  await readEvaluatePrintLoop(env, {
    l: 1,
    c: 1,
    f: replPromptPrefixOfNormalizedPath(cwd),
  });
})();
