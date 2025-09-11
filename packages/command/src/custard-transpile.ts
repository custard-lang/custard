import { transpileMain, commonProgram } from "./cli/common.js";

const result = commonProgram.parse();

(async () => await transpileMain(result.opts(), result.args))();
