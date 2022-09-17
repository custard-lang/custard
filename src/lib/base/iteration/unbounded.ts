// import { writeDebugOut } from "../../../util/debug";

import { transpile, transpileBlock } from "../../../transpile";
import { Block, Env, Form, JsSrc, Scope, TranspileError } from "../../../types";

export namespace Unbounded {
  export function __while(
    env: Env,
    bool: Form,
    ...rest: Block
  ): JsSrc | TranspileError {
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
    return `while(${boolSrc}){\n${statementsSrc}\n}`;
  }
}

export function unbounded(): Scope {
  const b = new Map();

  b.set("while", Unbounded.__while);

  return b;
}
