// Only for temporary files in tests.
// DO NOT use this for general perpose temporary file creation.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pid } from "node:process";
import { threadId } from "node:worker_threads";

import { FilePath } from "../types";
import { pathOfImportMetaUrl } from "../util/path";

let count = 0;

const tmpDir = path.join(
  path.dirname(
    path.dirname(path.dirname(pathOfImportMetaUrl(import.meta.url))),
  ),
  "tmp",
);

export type SrcAndDestPaths = {
  src: FilePath;
  dest: FilePath;
};

export async function withNewPath<T>(
  body: (paths: SrcAndDestPaths) => Promise<T>,
): Promise<T> {
  const src = path.join(tmpDir, `t${pid}-${threadId}-${count}.cstd`);
  await fs.writeFile(src, "");

  const dest = path.join(tmpDir, `t${pid}-${threadId}-${count}.js`);
  count++;
  try {
    return await body({ src, dest });
  } finally {
    await fs.rm(src, { force: true });
    await fs.rm(dest, { force: true });
  }
}
