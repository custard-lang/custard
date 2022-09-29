import * as EnvF from "../../env.js";
import { isCall } from "../../transpile";
import { Call, Env, Form, Writer } from "../../types";
import { Unbounded } from "./iteration/unbounded";
import { Safe } from "./safe";

export function isNonExpressionCall(env: Env, form: Form): form is Call {
  if (!isCall(form)) {
    return false;
  }
  const nonExpressions: (Writer | undefined)[] = [
    Safe.__const,
    Safe.__let,
    Safe.__return,
    Safe.incrementF,
    Safe.decrementF,
    Safe.when,
    Unbounded.__while,
  ];
  return nonExpressions.includes(EnvF.find(env, form[0].v));
}
