import { globIterate } from "glob";
import { program } from "@commander-js/extra-typings";

import * as path from "node:path";
import * as fs from "node:fs/promises";

import {
  defaultProvidedSymbolsConfig,
  ParseError,
  implicitlyImporting,
  readBlock,
  transpileModule,
  type Block,
  ProvidedSymbolsConfig,
  evalBlock,
  standardModuleRoot,
  ValidationError,
  initializeForRepl,
  readerInputOf,
  readerInput,
  Form,
  isParseError,
} from "@custard-lang/processor";
import { assertNonError } from "@custard-lang/processor/dist/util/error.js";

export const transpileProgram = program
  .option(
    "-p, --provided-symbols <path>",
    "Path to provided symbols config file.",
    "./.provided-symbols.cstd",
  )
  .option("-v, --verbose", "Enable verbose output.")
  .arguments("[files...]");

export async function transpileMain(
  opts: { providedSymbols: string; verbose?: true | undefined },
  args: string[],
): Promise<string[]> {
  const providedSymbolsPath = opts.providedSymbols;

  const env = await initializeForRepl(
    { srcPath: providedSymbolsPath },
    {
      from: providedSymbolsPath,
      ...implicitlyImporting(`${standardModuleRoot}/base/safe.js`),
    },
  );

  if (env instanceof Error) {
    throw env;
  }
  let providedSymbolsBlock: Block | ParseError<Form>;
  try {
    providedSymbolsBlock = readBlock(
      readerInputOf(env, await fs.readFile(providedSymbolsPath, "utf-8")),
    );
  } catch (e) {
    // There's no way to distinguish the "Not Found" error from the other errors except for using `any`!
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if (e instanceof Error && (e as { [key: string]: any }).code === "ENOENT") {
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.info(
          `Provided symbols config file not found at ${providedSymbolsPath}. Using the default`,
        );
      }
      providedSymbolsBlock = readBlock(
        readerInput(
          "@custard-lang/processor/src/default-provided-symbols.ts",
          defaultProvidedSymbolsConfig,
        ),
      );
    } else {
      throw e;
    }
  }
  if (isParseError(providedSymbolsBlock)) {
    throw providedSymbolsBlock;
  }
  const providedSymbolsConfig = ProvidedSymbolsConfig.validate(
    assertNonError(await evalBlock(providedSymbolsBlock, env)),
  );
  if (ValidationError.is(providedSymbolsConfig)) {
    // eslint-disable-next-line no-console
    console.error("Error when validating the provided symbols config.");
    throw providedSymbolsConfig;
  }

  const destPaths: string[] = [];
  const srcs = globIterate(args, {
    windowsPathsNoEscape: process.platform === "win32",
  });
  for await (const srcPath of srcs) {
    if (opts.verbose) {
      // eslint-disable-next-line no-console
      console.info(`Transpiling ${srcPath}...`);
    }
    const block = readBlock(
      readerInput(srcPath, await fs.readFile(srcPath, "utf-8")),
    );
    if (block instanceof Error) {
      // eslint-disable-next-line no-console
      console.error("Error when parsing the source file.");
      throw block;
    }
    const sp = path.parse(srcPath);
    const destPath = path.join(sp.dir, `${sp.name}.mjs`);
    const transpiled = await transpileModule(
      block,
      { srcPath },
      {
        from: providedSymbolsPath,
        ...providedSymbolsConfig,
      },
    );
    if (transpiled instanceof Error) {
      // eslint-disable-next-line no-console
      console.error("Error when transpiling the source file.");
      throw transpiled;
    }
    await fs.writeFile(destPath, transpiled, "utf-8");
    if (opts.verbose) {
      // eslint-disable-next-line no-console
      console.info("Transpiled to", destPath);
    }

    destPaths.push(destPath);
  }
  return destPaths;
}
