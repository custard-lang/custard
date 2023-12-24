import * as os from "node:os";
import { execFileSync } from "node:child_process";

import { writeFile, opendir, rm, readFile } from "fs/promises";
import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import * as iso8601ForFs from "../src/iso8601ForFs.mjs";

describe("split.cstd", () => {
  beforeAll(() => {
    execFileSync(os.platform() === "win32" ? "npm.cmd" : "npm", [
      "--prefix=../../",
      "run",
      "--",
      "custard",
      "transpile",
      "-p",
      "./apps/save-posts/.provided-symbols.cstd",
      "./apps/save-posts/src/split.cstd",
      "./apps/save-posts/src/iso8601ForFs.cstd",
    ]);
  });

  const postCount = 45;
  const input = Array.from({ length: postCount }).map((_, i) => {
    // Write posts for testing in reverse chronological order.
    const s = (postCount - i).toString().padStart(2, "0");
    return { indexedAt: `2023-10-23T09:00:${s}.000Z` };
  });
  const outDir = "tmp";
  const pathOfPostAt = (i: number) =>
    `${outDir}/${iso8601ForFs.toFileName(input[i].indexedAt, ".json")}`;
  const inputPath = pathOfPostAt(0);

  beforeEach(async () => {
    for await (const { name } of await opendir("tmp")) {
      if (name.endsWith(".json")) {
        await rm(`tmp/${name}`, { maxRetries: 3 });
      }
    }

    await writeFile(inputPath, JSON.stringify(input, null, 2));

    execFileSync("node", ["src/split.mjs", inputPath]);
  });

  it("should split the input.json by 20 posts and make a backup for the input file", async () => {
    console.log("Make backup for the input file");
    expect(input).toEqual(
      JSON.parse(await readFile(`${inputPath}.bk`, "utf-8")),
    );

    console.log("Split the first 20 posts");
    expect(input.slice(0, 20)).toEqual(
      JSON.parse(await readFile(pathOfPostAt(0), "utf-8")),
    );

    console.log("Split the second 20 posts");
    expect(input.slice(20, 40)).toEqual(
      JSON.parse(await readFile(pathOfPostAt(20), "utf-8")),
    );

    console.log("Split the rest 5 posts");
    expect(input.slice(40, 45)).toEqual(
      JSON.parse(await readFile(pathOfPostAt(40), "utf-8")),
    );
  });
});
