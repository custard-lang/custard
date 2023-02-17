import { Repl } from "./repl";
import { Block, Form } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

export async function evalForm(form: Form, repl: Repl): Promise<any | Error> {
  return await repl.sendEvalCommand({ command: "evalForm", form });
}

export async function evalBlock(
  block: Block,
  repl: Repl,
): Promise<any | Error> {
  return await repl.sendEvalCommand({ command: "evalBlock", block });
}
