import { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";
import { transpileBlock } from "../transpile.js";
import { Block, Env } from "../types.js";

export function readString(input: string): Block | ParseError {
  return readBlock(input);
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function evaluate(block: Block, env: Env): any | Error {
  return transpileBlock(block, env);
}
