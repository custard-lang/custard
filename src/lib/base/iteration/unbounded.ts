// import { writeDebugOut } from "../../../util/debug";

import * as EnvF from "../../../env.js";
import {
  transpile,
  transpileBlock,
} from "../../../transpile";
import { Block, Env, Form, JsSrc, Scope, TranspileError } from "../../../types";

import { iteration } from "../iteration.js";
import { isNonExpressionCall } from "./common.js";

export namespace Unbounded {
  export function __while(
    env: Env,
    bool: Form,
    ...rest: Block
  ): JsSrc | TranspileError {
    EnvF.push(env);

    if (bool === undefined) {
      return new TranspileError(
        "No conditional expression given to a `while` statement!"
      );
    }
    if (rest.length < 1) {
      return new TranspileError("No statements given to a `while` statement!");
    }

    if (isNonExpressionCall(env, bool)) {
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${bool[0].v}\` is a statement!`
      );
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

  export function __for(
    env: Env,
    initialStatement: Form,
    bool: Form,
    final: Form,
    ...rest: Block
  ): JsSrc | TranspileError {
    EnvF.push(env);

    if (iniitalStatement === undefined) {
      return new TranspileError(
        "No initial statement given to a `for` statement!"
      );
    }

    if (bool === undefined) {
      return new TranspileError(
        "No conditional expression given to a `for` statement!"
      );
    }

    if (final === undefined) {
      return new TranspileError(
        "No final expression given to a `for` statement!"
      );
    }

    if (rest.length < 1) {
      return new TranspileError("No statements given to a `for` statement!");
    }

    if (isNonExpressionCall(env, bool)) {
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${bool[0].v}\` is a statement!`
      );
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
  }
}

export function unbounded(): Scope {
  const b = iteration();

  b.set("while", Unbounded.__while);
  b.set("for", Unbounded.__for)

  return b;
}
