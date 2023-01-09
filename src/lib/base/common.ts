import * as EnvF from "../../env.js";
import { asCall } from "../../transpile";
import { Call, Env, Form, Writer } from "../../types";
import { Iteration } from "./iteration";
import { Unbounded } from "./iteration/unbounded";
import { Safe } from "./safe";

export function isNonExpressionCall(env: Env, form: Form): form is Call {
  const call = asCall(form);
  if (call === undefined) {
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
    Unbounded.__for,
    Unbounded.forEach,
    Unbounded.recursive,
    Iteration.__break,
    Iteration.__continue,
  ];
  return nonExpressions.includes(EnvF.find(env, call[0]));
}
