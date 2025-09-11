#!/bin/env node

import { program } from "@commander-js/extra-typings";

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
