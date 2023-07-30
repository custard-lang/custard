import * as fs from "node:fs/promises";

import { FilePath } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
export async function writeAndEval(
  p: FilePath,
  src: string,
): Promise<Record<string, any>> {
  await fs.writeFile(p, src);
  return await import(p);
}
