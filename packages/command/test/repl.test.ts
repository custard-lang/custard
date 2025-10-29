import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..", "..", "..");

describe("custard repl", () => {
  it("should handle multiline input command", async () => {
    const custardPath = join(rootDir, "packages/command/dist/custard.js");

    const input = `[
  "test"
  "input"
]
`;

    const expectedOutput = [
      `${rootDir}//<NO FILE>:1:>>> `,
      `${rootDir}//<NO FILE>:2:... `,
      `${rootDir}//<NO FILE>:3:... `,
      `${rootDir}//<NO FILE>:4:... [ 'test', 'input' ]\n`,
      `${rootDir}//<NO FILE>:5:>>> `,
    ].join(""); // The newline is inserted by the user pressing Enter

    const result = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
    }>((resolve) => {
      const child = spawn("node", [custardPath, "repl"], {
        cwd: rootDir,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += (data as Buffer).toString();
      });

      child.stderr.on("data", (data) => {
        stderr += (data as Buffer).toString();
      });

      child.on("close", (exitCode) => {
        resolve({ stdout, stderr, exitCode });
      });

      // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
      child.stdin.write(input, () => {
        child.stdin.end();
      });
    });

    expect.soft(result.exitCode).toBe(0);
    expect.soft(result.stdout).toBe(expectedOutput);
    expect.soft(result.stderr).toBe("");
  });
});
