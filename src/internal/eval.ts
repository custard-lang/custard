import { Env, TranspileRepl } from "./types.js";
import { Block, Form } from "../types.js";
import {
  appendJsStatement,
  transpileBlock,
  transpileBlockCore,
  transpileStatement,
} from "./transpile.js";
import { _cu$eval } from "./isolated-eval.js";

import { isNonExpressionCall } from "../lib/base/common.js";
import { ParseError } from "../grammar.js";
import { readBlock } from "../reader.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

export async function evalForm(
  ast: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsMod = await transpileStatement(ast, env);
  if (jsMod instanceof Error) {
    return jsMod;
  }
  try {
    return await _cu$eval(
      {
        imports: jsMod.imports,
        body: "",
        lastExpression: jsMod.body,
      },
      env,
    );
  } catch (e) {
    return e;
  }
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsMod = await transpileBlockCore(
    forms,
    env,
    { mayHaveResult: true }
  );
  if (jsMod instanceof Error) {
    return jsMod;
  }

  try {
    return await _cu$eval(jsMod, env);
  } catch (e) {
    return e;
  }
}

export async function evalString(
  formsString: string,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const forms = readBlock(formsString);
  if (forms instanceof ParseError) {
    return forms;
  }
  return evalBlock(forms, env);
}
