// import { writeDebugOut } from "../../../util/debug";

import * as EnvF from "../../../env.js";
import {
  asCall,
  transpileBlock,
  transpileExpression,
  transpileStatement,
} from "../../../transpile";
import {
  Block,
  Env,
  Form,
  JsSrc,
  TranspileError,
  isCuSymbol,
  aConst,
  aRecursiveConst,
  Scope,
  showSymbolAccess,
} from "../../../types";

import { iteration } from "../iteration.js";
import { isNonExpressionCall } from "../common.js";
import { Safe } from "../safe.js";

export namespace Unbounded {
  export async function __while(
    env: Env,
    bool: Form,
    ...rest: Block
  ): Promise<JsSrc | TranspileError> {
    if (bool === undefined) {
      return new TranspileError(
        "No conditional expression given to a `while` statement!",
      );
    }
    if (rest.length < 1) {
      return new TranspileError("No statements given to a `while` statement!");
    }

    if (isNonExpressionCall(env, bool)) {
      const id = showSymbolAccess(bool[0]);
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${id}\` is a statement!`,
      );
    }

    const boolSrc = await transpileExpression(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }

    EnvF.push(env);

    const statementsSrc = await transpileBlock(rest, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return `while(${boolSrc}){\n${statementsSrc}\n}`;
  }

  export async function __for(
    env: Env,
    initialStatement: Form,
    bool: Form,
    final: Form,
    ...rest: Block
  ): Promise<JsSrc | TranspileError> {
    EnvF.push(env);

    if (initialStatement === undefined) {
      return new TranspileError(
        "No initialization statement given to a `for` statement!",
      );
    }

    if (bool === undefined) {
      return new TranspileError(
        "No conditional expression given to a `for` statement!",
      );
    }

    if (final === undefined) {
      return new TranspileError(
        "No final expression given to a `for` statement!",
      );
    }

    if (rest.length < 1) {
      return new TranspileError("No statements given to a `for` statement!");
    }

    if (isNonExpressionCall(env, bool)) {
      const id = showSymbolAccess(bool[0]);
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${id}\` is a statement!`,
      );
    }

    const initialStatementSrc = await transpileStatement(initialStatement, env);
    if (initialStatementSrc instanceof TranspileError) {
      return initialStatementSrc;
    }
    const boolSrc = await transpileExpression(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }
    const finalSrc = await transpileExpression(final, env);
    if (finalSrc instanceof TranspileError) {
      return finalSrc;
    }
    const statementsSrc = await transpileBlock(rest, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return `for(${initialStatementSrc};${boolSrc};${finalSrc}){${statementsSrc}}`;
  }

  export async function forEach(
    env: Env,
    id: Form,
    iterable: Form,
    ...statements: Block
  ): Promise<JsSrc | TranspileError> {
    EnvF.push(env);

    if (id === undefined) {
      return new TranspileError(
        "No variable name given to a `forEach` statement!",
      );
    }
    if (!isCuSymbol(id)) {
      return new TranspileError(
        "The first argument to `for` must be a symbol!",
      );
    }
    if (iterable === undefined) {
      return new TranspileError(
        "No iterable expression given to a `forEach` statement!",
      );
    }
    if (statements.length < 1) {
      return new TranspileError(
        "No statements given to a `forEach` statement!",
      );
    }

    const iterableSrc = await transpileExpression(iterable, env);
    if (iterableSrc instanceof TranspileError) {
      return iterableSrc;
    }

    const r = EnvF.set(env, id.v, aConst());
    if (r instanceof TranspileError) {
      return r;
    }

    const statementsSrc = await transpileBlock(statements, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }

    EnvF.pop(env);

    return `for(const ${id.v} of ${iterableSrc}) {${statementsSrc}}`;
  }

  export async function recursive(
    env: Env,
    ...consts: Block
  ): Promise<JsSrc | TranspileError> {
    if (consts.length < 1) {
      return new TranspileError("No `const` statements given to `recursive`!");
    }

    for (const statement of consts) {
      const call = asCall(statement);
      if (call === undefined) {
        return new TranspileError(
          "All arguments in `recursive` must be `const` declarations!",
        );
      }
      const declName = EnvF.find(env, call[0]);
      if (declName !== Safe.__const) {
        return new TranspileError(
          "All declarations in `recursive` must be `const`!",
        );
      }

      const id = call[1];
      if (!isCuSymbol(id)) {
        return new TranspileError(`${JSON.stringify(id)} is not a symbol!`);
      }
      const r = EnvF.set(env, id.v, aRecursiveConst());
      if (r instanceof TranspileError) {
        return r;
      }
    }

    return await transpileBlock(consts, env);
  }
}

export function unbounded(): Scope {
  const b = iteration();

  b.set("while", Unbounded.__while);
  b.set("for", Unbounded.__for);
  b.set("forEach", Unbounded.forEach);
  b.set("recursive", Unbounded.recursive);

  return b;
}
