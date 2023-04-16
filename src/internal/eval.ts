import { Env, TranspileRepl } from "./types.js";
import { Block, Form } from "../types.js";
import { appendJsStatement, transpileBlock, transpileStatement } from "./transpile.js";
import { _cu$eval } from "./isolated-eval.js";

import { isNonExpressionCall } from "../lib/base/common.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

export async function evalForm(
  ast: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileStatement(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  try {
    return await _cu$eval("", jsSrc, env);
  } catch (e) {
    return e;
  }
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileBlock(forms.slice(0, -1), env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }

  const lastForm = forms[forms.length - 1];
  const lastIsNonExpression = isNonExpressionCall(env, lastForm);

  const lastJsSrc = await transpileStatement(lastForm, env);
  if (lastJsSrc instanceof Error) {
    return lastJsSrc;
  }

  try {
    if (lastIsNonExpression) {
      return await _cu$eval(appendJsStatement(jsSrc, lastJsSrc), "", env);
    }
    return await _cu$eval(jsSrc, lastJsSrc, env);
  } catch (e) {
    return e;
  }
}
