#!/bin/env node

import { program } from "@commander-js/extra-typings";
import { getLogger } from "@custard-lang/processor";

const log = getLogger("custard");

try {
  // The experimental version of `import.meta.resolve` is used in
  // processor/src/internal/context.ts
  process.execArgv.push("--experimental-import-meta-resolve");

  program
    .name("custard")
    .version("0.1.0")
    .command("transpile [files...]", "Transpile .cstd files into .js files.")
    .command(
      "run [file] [args...]",
      "Transpile .cstd files into .js files, then run.",
    )
    .command("repl [files...]", "Start a Custard REPL session.", {
      isDefault: true,
    })
    .parse();
} catch (e) {
  log.debugThrown(e);
  throw e;
}
