import { Env, TranspileRepl } from "./types.js";
import { Block, Form } from "../types.js";
import {
  appendJsStatement,
  transpileBlock,
  transpileStatement,
} from "./transpile.js";
import { _cu$eval } from "./isolated-eval.js";

import { isNonExpressionCall } from "../lib/base/common.js";

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
  const jsMod = await transpileBlock(forms.slice(0, -1), env);
  if (jsMod instanceof Error) {
    return jsMod;
  }

  const lastForm = forms[forms.length - 1];
  const lastIsNonExpression = isNonExpressionCall(env, lastForm);

  const last = await transpileStatement(lastForm, env);
  if (last instanceof Error) {
    return last;
  }

  try {
    if (lastIsNonExpression) {
      return await _cu$eval(
        {
          ...appendJsStatement(jsMod, last),
          lastExpression: "",
        },
        env,
      );
    }
    return await _cu$eval({ ...jsMod, lastExpression: last.body }, env);
  } catch (e) {
    return e;
  }
}
