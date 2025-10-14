import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";

export const rl = readline.createInterface({ input, output });

export function finalize(): void {
  rl.close();
  input.destroy();
}

export async function question(prompt: string): Promise<string> {
  return await rl.question(prompt);
}
