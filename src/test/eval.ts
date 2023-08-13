import * as fs from "node:fs/promises";

import { FilePath } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
export async function writeAndEval(p: FilePath, src: string): Promise<any> {
  await fs.writeFile(p, src);
  return (await import(p)).default;
}
