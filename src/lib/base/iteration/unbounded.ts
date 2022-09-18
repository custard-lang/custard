// import { writeDebugOut } from "../../../util/debug";

import * as EnvF from "../../../env.js";
import { transpile, transpileBlock } from "../../../transpile";
import { Block, Env, Form, JsSrc, Scope, TranspileError } from "../../../types";

import { iteration } from "../iteration.js";

export namespace Unbounded {
  export function __while(
    env: Env,
    bool: Form,
    ...rest: Block
  ): JsSrc | TranspileError {
    EnvF.push(env);

    if (bool === undefined) {
      return new TranspileError("No expression given to an `while` statement!");
    }
    if (rest.length < 1) {
      return new TranspileError("No statements given to an `while` statement!");
    }
    const boolSrc = transpile(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }
    const statementsSrc = transpileBlock(rest, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return `while(${boolSrc}){\n${statementsSrc}\n}`;
  }
}

export function unbounded(): Scope {
  const b = iteration();

  b.set("while", Unbounded.__while);

  return b;
}
