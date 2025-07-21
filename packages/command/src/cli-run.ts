import { spawn } from "node:child_process";

import { transpileMain, transpileProgram } from "./cli/common.js";

const result = transpileProgram
  .option(
    "-w, --with-engine <path>",
    "Path to the JavaScript engine to run",
    "node",
  )
  .argument("[file]")
  .arguments("[args...]")
  .parse();

(async () => {
  const [cstdPath, ...args] = result.args;
  if (cstdPath === undefined) {
    // eslint-disable-next-line no-console
    console.error("No .cstd file specified");
    process.exit(1);
  }
  const opts = result.opts();
  const [mjsPath] = await transpileMain(opts, [cstdPath]);

  if (mjsPath === undefined) {
    throw new Error("Assertion failed: no .mjs file transpiled.");
  }

  if (opts.verbose) {
    // eslint-disable-next-line no-console
    console.log("Running", mjsPath);
  }
  spawn(opts.withEngine, ["--", mjsPath, ...args], { stdio: "inherit" });
})();
