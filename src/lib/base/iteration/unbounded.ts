// import { writeDebugOut } from "../../../util/debug";

import * as EnvF from "../../../env.js";
import { isCall, transpile, transpileBlock } from "../../../transpile";
import {
  Block,
  Env,
  Form,
  JsSrc,
  TranspileError,
  isCuSymbol,
  aConst,
  aRecursiveConst,
  Definitions,
} from "../../../types";

import { iteration } from "../iteration.js";
import { isNonExpressionCall } from "../common.js";
import { Safe } from "../safe.js";

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

    if (initialStatement === undefined) {
      return new TranspileError(
        "No initialization statement given to a `for` statement!"
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

    const initialStatementSrc = transpile(initialStatement, env);
    if (initialStatementSrc instanceof TranspileError) {
      return initialStatementSrc;
    }
    const boolSrc = transpile(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }
    const finalSrc = transpile(final, env);
    if (finalSrc instanceof TranspileError) {
      return finalSrc;
    }
    const statementsSrc = transpileBlock(rest, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return `for(${initialStatementSrc};${boolSrc};${finalSrc}){${statementsSrc}}`;
  }

  export function forEach(
    env: Env,
    id: Form,
    iterable: Form,
    ...statements: Block
  ): JsSrc | TranspileError {
    EnvF.push(env);

    if (id === undefined) {
      return new TranspileError(
        "No variable name given to a `forEach` statement!"
      );
    }
    if (!isCuSymbol(id)) {
      return new TranspileError(
        "The first argument to `for` must be a symbol!"
      );
    }
    if (iterable === undefined) {
      return new TranspileError(
        "No iterable expression given to a `forEach` statement!"
      );
    }
    if (statements.length < 1) {
      return new TranspileError(
        "No statements given to a `forEach` statement!"
      );
    }

    const iterableSrc = transpile(iterable, env);
    if (iterableSrc instanceof TranspileError) {
      return iterableSrc;
    }

    const r = EnvF.set(env, id.v, aConst());
    if (r instanceof TranspileError) {
      return r;
    }

    const statementsSrc = transpileBlock(statements, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }

    EnvF.pop(env);

    return `for(const ${id.v} of ${iterableSrc}) {${statementsSrc}}`;
  }

  export function recursive(
    env: Env,
    ...consts: Block
  ): JsSrc | TranspileError {
    if (consts.length < 1) {
      return new TranspileError("No `const` statements given to `recursive`!");
    }

    for (const statement of consts) {
      if (!isCall(statement)) {
        return new TranspileError(
          "All arguments in `recursive` must be `const` declarations!"
        );
      }
      const declName = EnvF.find(env, statement[0].v);
      if (declName !== Safe.__const) {
        return new TranspileError(
          "All declarations in `recursive` must be `const`!"
        );
      }

      const id = statement[1];
      if (!isCuSymbol(id)) {
        return new TranspileError(`${JSON.stringify(id)} is not a symbol!`);
      }
      const r = EnvF.set(env, id.v, aRecursiveConst());
      if (r instanceof TranspileError) {
        return r;
      }
    }

    return transpileBlock(consts, env);
  }
}

export function unbounded(): Definitions {
  const b = iteration();

  b.set("while", Unbounded.__while);
  b.set("for", Unbounded.__for);
  b.set("forEach", Unbounded.forEach);
  b.set("recursive", Unbounded.recursive);

  return b;
}
