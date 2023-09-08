import { program } from "@commander-js/extra-typings";

import * as path from "node:path";
import * as fs from "node:fs/promises";

import { defaultProvidedSymbolsConfig } from "./default-provided-symbols.js";
import { ParseError } from "./grammar.js";
import { implicitlyImporting } from "./provided-symbols-config.js";
import { readBlock } from "./reader.js";
import { transpileModule } from "./transpile.js";
import { Block, ProvidedSymbolsConfig } from "./types.js";
import { evalBlock } from "./eval.js";
import { standardModuleRoot } from "./definitions.js";
import { ValidationError } from "./lib/spec.js";
import { initializeForRepl } from "./env.js";

const result = program
  .option(
    "-p, --provided-symbols <path>",
    "Path to provided symbols config file.",
    "./.provided-symbols.cstd",
  )
  .option("-v, --verbose", "Enable verbose output.")
  .parse();

(async () => {
  let providedSymbolsBlock: Block | ParseError;
  const opts = result.opts();
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

  for (const srcPath of result.args) {
    if (opts.verbose) {
      console.info(`Transpiling ${srcPath}...`);
    }
    const block = readBlock(await fs.readFile(srcPath, "utf-8"));
    if (block instanceof Error) {
      console.error("Error when parsing the source file.");
      throw block;
    }
    const sp = path.parse(srcPath);
    const destPath = path.join(`${sp.dir}`, `${sp.name}.js`);
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
  }
})();
