import * as fs from "node:fs/promises";

import { type FilePath } from "@custard-lang/processor/dist/types.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
export async function writeAndEval(p: FilePath, src: string): Promise<any> {
  // TODO: Write to a file executable by the dedicated custard's subcommand.
  // console.log(`${src}\n//------------------`);

  await fs.writeFile(p, src);
  return (await import(p)).default;
}
