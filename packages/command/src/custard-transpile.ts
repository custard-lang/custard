import { transpileMain, commonProgramForTranspiler } from "./cli/common.js";

const result = commonProgramForTranspiler.arguments("[files...]").parse();

(async () => await transpileMain(result.opts(), result.args))();
