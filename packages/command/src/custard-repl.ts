#!/usr/bin/env node

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs/promises";

import {
  type Context,
  ContextF,
  type Environment,
  EnvironmentF,
  evalForm,
  type Form,
  getLogger,
  isParseErrorSkipping,
  isParseErrorWantingMore,
  Location,
  ParseError,
  type ProvidedSymbolsConfig,
  readResumably,
  type TranspileRepl,
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
import { ParseErrorWantingMore } from "@custard-lang/processor/dist/grammar.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const log = getLogger("custard-repl");

const result = commonProgram.parse();
const opts = result.opts();

const srcPaths = result.args;
log.debug(
  `Starting REPL with arguments options: ${JSON.stringify([opts, srcPaths])}`,
);

const cwd = process.cwd();

// EVAL
async function evalCustard(
  ast: Form,
  context: Context<TranspileRepl>,
): Promise<any> {
  return await evalForm(ast, context);
}

(async () => {
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
  log.debug("Initial environment loaded.");

  const rl = readline.createInterface({ input, output });

  let isFinalized = false;
  function finalize(): void {
    if (isFinalized) return;
    isFinalized = true;
    rl.close();
    input.destroy();
  }

  function readEvaluatePrintLoop(
    env: Environment<TranspileRepl>,
    providedSymbols: ProvidedSymbolsConfig,
    providedSymbolsPath: FilePath,
    location: Location,
  ): void {
    let wantsMore: ParseErrorWantingMore<Form<Location>> | null = null;

    function prompt(promptPrefix: string): void {
      log.debug(
        `Displaying the ${JSON.stringify(promptPrefix)} prompt at ${JSON.stringify(location)}`,
      );
      rl.setPrompt(`${location.f}:${location.l}:${promptPrefix} `);
      rl.prompt();
    }

    function goToNextLine(promptPrefix: string): void {
      // The next position in the prompt should be
      // the beginning of the next line
      location.l++;
      location.c = 1; // Currently, the prompt doesn't show the column number, though.
      prompt(promptPrefix);
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    rl.on("line", async (answer): Promise<void> => {
      log.debug(`User input: ${answer}`);
      if (answer === ":q" || answer === ":quit") {
        finalize();
        return;
      }

      const loadMD = /^:l(?:oad)?\s+(.*)$/.exec(answer.trim());
      if (loadMD != null) {
        // This match group should always be non-null when the regex matches.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const filePath = loadMD[1]!;
        if (filePath === "") {
          // eslint-disable-next-line no-console
          console.error("No file path provided for :load command.");
          goToNextLine(">>>");
          return;
        }

        const src = await assertIsFile(filePath);
        if (src instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("Error loading the file:", filePath, src);
          goToNextLine(">>>");
          return;
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
          goToNextLine(">>>");
          return;
        }
        env = anotherEnv;

        location.f = ContextF.replPromptPrefixOfNormalizedPath(src);
        goToNextLine(">>>");
        return;
      }

      const context = EnvironmentF.getCurrentContext(env);
      let form: Form<Location> | ParseError<Form<Location>>;

      if (wantsMore === null) {
        const readerInput = ContextF.readerInputOf(context, answer, location.l);
        form = readResumably(readerInput);
      } else {
        form = wantsMore.resume(answer);
        wantsMore = null;
      }

      while (true) {
        if (isParseErrorSkipping(form)) {
          // eslint-disable-next-line no-console
          console.warn("ParseErrorSkipping", form.message);
          form = form.resume();
          continue;
        }
        if (isParseErrorWantingMore(form)) {
          wantsMore = form;
          goToNextLine("...");
          return;
        }
        break;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const evalResult = await evalCustard(form, context);
        if (evalResult instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("Error evaluating form:", evalResult);
        } else if (typeof evalResult === "string") {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(evalResult));
        } else {
          // eslint-disable-next-line no-console
          console.log(evalResult);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
      goToNextLine(">>>");
    });

    rl.on("close", () => {
      finalize();
    });

    prompt(">>>");
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

  readEvaluatePrintLoop(env, providedSymbolsConfig, providedSymbolsPath, {
    l: 1,
    c: 1,
    f: ContextF.replPromptPrefixOfNormalizedPath(srcsOrCwd[0]),
  });
})();
