import * as EnvF from "../../internal/env.js";
import { asCall } from "../../internal/transpile.js";
import { Env } from "../../internal/types.js";
import { Call, Form, Writer } from "../../types.js";
import { Iteration } from "./iteration.js";
import { Unbounded } from "./iteration/unbounded.js";
import { Safe } from "./safe.js";

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
