#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs/promises";

import {
  type Context,
  type Form,
  evalForm,
  type TranspileRepl,
  type Environment,
  type ProvidedSymbolsConfig,
  EnvironmentF,
  ContextF,
  readResumably,
  isParseErrorSkipping,
  isParseErrorWantingMore,
  Location,
  TranspileError,
} from "@custard-lang/processor";
import {
  assertIsFile,
  commonProgram,
  loadProvidedSymbols,
} from "./cli/common.js";
import {
  FilePath,
  FilePathAndStat,
} from "@custard-lang/processor/dist/internal/types.js";
import { isFileNotFoundError } from "@custard-lang/processor/dist/util/error.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const result = commonProgram.parse();
const srcPaths = result.args;

const rl = readline.createInterface({ input, output });

const cwd = process.cwd();

// EVAL
async function evalCustard(
  ast: Form,
  context: Context<TranspileRepl>,
): Promise<any> {
  return await evalForm(ast, context);
}

function finalize(): void {
  rl.close();
  input.destroy();
}

async function readEvaluatePrintLoop(
  env: Environment<TranspileRepl>,
  providedSymbols: ProvidedSymbolsConfig,
  providedSymbolsPath: FilePath,
  location: Location,
): Promise<void> {
  try {
    while (true) {
      const answer = await ask(location, ">>>");
      if (answer === ":q" || answer === ":quit") {
        finalize();
        break;
      }

      const loadMD = /^:l(?:oad)?\s+(.*)$/.exec(answer.trim());
      if (loadMD != null) {
        // This match group should always be non-null when the regex matches.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const filePath = loadMD[1]!;
        if (filePath === "") {
          // eslint-disable-next-line no-console
          console.error("No file path provided for :load command.");
          continue;
        }

        const src = await assertIsFile(filePath);
        if (src instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("Error loading the file:", filePath, src);
          continue;
        }

        // Load the file and switch context
        const anotherEnv = await EnvironmentF.loadToSwitchContext(
          env,
          { src },
          providedSymbols,
          providedSymbolsPath,
        );
        if (anotherEnv instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("Error loading file:", filePath, anotherEnv);
          continue;
        }
        env = anotherEnv;

        location.f = ContextF.replPromptPrefixOfNormalizedPath(src);
        setDownToNextLine(location);
        continue;
      }

      const context = EnvironmentF.getCurrentContext(env);
      const readerInput = ContextF.readerInputOf(context, answer, location.l);
      if (TranspileError.is(readerInput)) {
        // TODO: perhaps this should not be executed
        // eslint-disable-next-line no-console
        console.error("Error preparing input:", readerInput);
        setDownToNextLine(location);
        continue;
      }
      let form = readResumably(readerInput);
      while (true) {
        if (isParseErrorSkipping(form)) {
          // eslint-disable-next-line no-console
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const evalResult = await evalCustard(form, context);
        if (evalResult instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("Error evaluating form:", evalResult);
          continue;
        }
        // eslint-disable-next-line no-console
        console.log(evalResult);
      } catch (e) {
        // eslint-disable-next-line no-console
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

async function toPathAndStats(paths: FilePath[]): Promise<FilePathAndStat[]> {
  const result: FilePathAndStat[] = [];
  for (const path of paths) {
    try {
      const realStat = await fs.stat(path);
      result.push({ path, isDirectory: realStat.isDirectory() });
    } catch (e) {
      if (isFileNotFoundError(e)) {
        // eslint-disable-next-line no-console
        console.error(`"[ERROR] ${path}" not found. Ignoring.`);
      }
      throw e;
    }
  }
  return result;
}

(async () => {
  const opts = result.opts();
  const providedSymbolsPath = opts.providedSymbols;
  const providedSymbolsConfig = await loadProvidedSymbols(
    providedSymbolsPath,
    opts,
  );

  const srcs = await toPathAndStats(srcPaths);
  const srcsOrCwd: [FilePathAndStat, ...FilePathAndStat[]] =
    srcs.length > 0
      ? (srcs as [FilePathAndStat, ...FilePathAndStat[]])
      : [{ path: cwd, isDirectory: true }];
  const env = await EnvironmentF.loadAll(srcsOrCwd, providedSymbolsConfig, cwd);
  if (env instanceof Error) {
    // eslint-disable-next-line no-console
    console.error("Error initializing the REPL environment:", env);
    process.exit(1);
  }
  await readEvaluatePrintLoop(env, providedSymbolsConfig, providedSymbolsPath, {
    l: 1,
    c: 1,
    f: ContextF.replPromptPrefixOfNormalizedPath(srcsOrCwd[0]),
  });
})();
