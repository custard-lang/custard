import * as EnvF from "../../internal/env.js";
import { asCall } from "../../internal/transpile.js";
import { Env } from "../../internal/types.js";
import { Call, Form, Writer } from "../../types.js";
import * as Iteration from "./iteration.js";
import * as Unbounded from "./iteration/unbounded.js";
import * as Safe from "./safe.js";
import * as Module from "./module.js";

export function isNonExpressionCall(env: Env, form: Form): form is Call {
  const call = asCall(form);
  if (call === undefined) {
    return false;
  }
  const nonExpressions: (Writer | undefined)[] = [
    Safe._cu$const,
    Safe._cu$let,
    Safe._cu$return,
    Safe.incrementF,
    Safe.decrementF,
    Safe.when,
    Unbounded._cu$while,
    Unbounded._cu$for,
    Unbounded.forEach,
    Unbounded.recursive,
    Iteration._cu$break,
    Iteration._cu$continue,
    Module._cu$import,
  ];
  return nonExpressions.includes(EnvF.find(env, call[0]));
}
