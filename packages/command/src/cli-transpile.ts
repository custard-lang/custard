import { transpileMain, transpileProgram } from "./cli/common.js";

const result = transpileProgram.parse();

(async () => await transpileMain(result.opts(), result.args))();
