import { globIterate } from "glob";
import { Option, Command } from "@commander-js/extra-typings";

import * as path from "node:path";
import * as fs from "node:fs/promises";

import {
  assumeIsFile,
  type Block,
  Context,
  ContextF,
  evalBlock,
  Form,
  implicitlyImporting,
  isParseError,
  Location,
  ParseError,
  ProvidedSymbolsConfig,
  readBlock,
  readerInput,
  standardModuleRoot,
  transpileModule,
  TranspileRepl,
  ValidationError,
} from "@custard-lang/processor";
import {
  assertNonError,
  isFileNotFoundError,
} from "@custard-lang/processor/dist/util/error.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";
import {
  FilePath,
  FilePathAndStat,
  fromDefaultTranspileOptions,
  type RuntimeModuleEmission,
  RuntimeModuleEmissionValues,
} from "@custard-lang/processor/dist/types.js";

export interface TranspileMainOptions {
  providedSymbols: string;
  verbose?: true | undefined;
  runtimeModules: RuntimeModuleEmission;
}

const optRuntimeModulesDescription = new Option(
  "--runtime-modules <type>",
  "How to include runtime modules in the resulted JavaScript file.",
)
  .choices(RuntimeModuleEmissionValues)
  .default("import");

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildCommonProgram() {
  return new Command()
    .option(
      "-p, --provided-symbols <path>",
      "Path to provided symbols config file.",
      "./.provided-symbols.cstd",
    )
    .option("-v, --verbose", "Enable verbose output.");
}

export const commonProgramForRepl = buildCommonProgram();

export const commonProgramForTranspiler = buildCommonProgram().addOption(
  optRuntimeModulesDescription,
);

export async function loadProvidedSymbols(
  providedSymbolsPath: string,
  opts: { verbose?: true | undefined },
): Promise<ProvidedSymbolsConfig> {
  const [providedSymbolsBlock, context] = await loadProvidedSymbolsBlock(
    providedSymbolsPath,
    opts,
  );
  if (isParseError(providedSymbolsBlock)) {
    throw providedSymbolsBlock;
  }
  const providedSymbolsConfig = ProvidedSymbolsConfig.validate(
    assertNonError(await evalBlock(providedSymbolsBlock, context)),
  );
  if (ValidationError.is(providedSymbolsConfig)) {
    // eslint-disable-next-line no-console
    console.error("Error when validating the provided symbols config.");
    throw providedSymbolsConfig;
  }
  return providedSymbolsConfig;
}

export async function transpileMain(
  opts: TranspileMainOptions,
  args: string[],
): Promise<string[]> {
  const providedSymbolsPath = opts.providedSymbols;
  const providedSymbolsConfig = await loadProvidedSymbols(
    providedSymbolsPath,
    opts,
  );

  const destPaths: string[] = [];
  const srcPaths = globIterate(args, {
    windowsPathsNoEscape: process.platform === "win32",
  });
  for await (const srcPath of srcPaths) {
    if (opts.verbose) {
      // eslint-disable-next-line no-console
      console.info(`Transpiling ${srcPath}...`);
    }
    const src = assumeIsFile(srcPath);
    const block = readBlock(
      readerInput(src, await fs.readFile(srcPath, "utf-8")),
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
      { src, runtimeModuleEmission: opts.runtimeModules },
      providedSymbolsConfig,
      providedSymbolsPath,
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

async function loadProvidedSymbolsBlock(
  providedSymbolsPath: string,
  opts: {
    verbose?: true | undefined;
  },
): Promise<[Block<Location> | ParseError<Form>, Context<TranspileRepl>]> {
  const cwd = process.cwd();

  async function fallbackIntoDefault(
    e: unknown,
  ): Promise<[Block<Location> | ParseError<Form>, Context<TranspileRepl>]> {
    if (isFileNotFoundError(e)) {
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.info(
          `Provided symbols config file not found at ${providedSymbolsPath}. Using the default`,
        );
      }

      const src = assumeIsFile(
        "@custard-lang/processor/src/default-provided-symbols.cstd",
      );
      const context = await ContextF.initializeForRepl(
        fromDefaultTranspileOptions({ src }),
        implicitlyImporting(`${standardModuleRoot}/base/safe.js`),
        cwd,
      );
      if (context instanceof Error) {
        throw context;
      }
      const defaultProvidedSymbolsConfigPath = import.meta.resolve(src.path);
      return [
        readBlock(
          readerInput(
            src,
            await fs.readFile(
              fileOfImportMetaUrl(defaultProvidedSymbolsConfigPath),
              "utf-8",
            ),
          ),
        ),
        context,
      ];
    }
    throw e;
  }

  const context = await ContextF.initializeForRepl(
    fromDefaultTranspileOptions({ src: assumeIsFile(providedSymbolsPath) }),
    implicitlyImporting(`${standardModuleRoot}/base/safe.js`),
    cwd,
  );

  if (context instanceof Error) {
    return await fallbackIntoDefault(context);
  }

  try {
    const contents = await fs.readFile(providedSymbolsPath, "utf-8");
    const ri = ContextF.readerInputOf(context, contents);
    return [readBlock(ri), context];
  } catch (e) {
    return await fallbackIntoDefault(e);
  }
}

export async function assertIsFile(
  path: FilePath,
): Promise<FilePathAndStat | Error> {
  try {
    const stat = await fs.stat(path);
    if (!stat.isFile()) {
      return new Error(`${path} is not a file!`);
    }
  } catch (e) {
    if (e instanceof Error) {
      return e;
    }
    throw e;
  }
  return assumeIsFile(path);
}
