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
  Block,
  ProvidedSymbolsConfig,
  evalBlock,
  standardModuleRoot,
  ValidationError,
  initializeForRepl,
} from "@custard-lang/processor";

export const transpileProgram = program
  .option(
    "-p, --provided-symbols <path>",
    "Path to provided symbols config file.",
    "./.provided-symbols.cstd",
  )
  .option("-v, --verbose", "Enable verbose output.");

export async function transpileMain(
  opts: { providedSymbols: string; verbose?: true | undefined },
  args: string[],
): Promise<string[]> {
  let providedSymbolsBlock: Block | ParseError;
  const providedSymbolsPath = opts.providedSymbols;
  try {
    providedSymbolsBlock = readBlock(
      await fs.readFile(providedSymbolsPath, "utf-8"),
    );
  } catch (e) {
    // There's no way to distinguish the "Not Found" error from the other errors except for using `any`!
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if (e instanceof Error && (e as Record<string, any>).code === "ENOENT") {
      if (opts.verbose) {
        console.info(
          `Provided symbols config file not found at ${providedSymbolsPath}. Using the default`,
        );
      }
      providedSymbolsBlock = readBlock(defaultProvidedSymbolsConfig);
    } else {
      throw e;
    }
  }
  if (ParseError.is(providedSymbolsBlock)) {
    throw providedSymbolsBlock;
  }

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
  const providedSymbolsConfig = ProvidedSymbolsConfig.validate(
    await evalBlock(providedSymbolsBlock, env),
  );
  if (ValidationError.is(providedSymbolsConfig)) {
    console.error("Error when validating the provided symbols config.");
    throw providedSymbolsConfig;
  }

  const destPaths: string[] = [];
  for await (const srcPath of globIterate(args)) {
    if (opts.verbose) {
      console.info(`Transpiling ${srcPath}...`);
    }
    const block = readBlock(await fs.readFile(srcPath, "utf-8"));
    if (block instanceof Error) {
      console.error("Error when parsing the source file.");
      throw block;
    }
    const sp = path.parse(srcPath);
    const destPath = path.join(`${sp.dir}`, `${sp.name}.mjs`);
    const transpiled = await transpileModule(
      block,
      { srcPath },
      {
        from: providedSymbolsPath,
        ...providedSymbolsConfig,
      },
    );
    if (transpiled instanceof Error) {
      console.error("Error when transpiling the source file.");
      throw transpiled;
    }
    await fs.writeFile(destPath, transpiled, "utf-8");
    if (opts.verbose) {
      console.info("Transpiled to", destPath);
    }

    destPaths.push(destPath);
  }
  return destPaths;
}
