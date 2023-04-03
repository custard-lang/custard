import * as EnvF from "../../../internal/env.js";
import {
  asCall,
  transpileBlock,
  transpileExpression,
  transpileStatement,
} from "../../../internal/transpile.js";
import {
  Env,
  Block,
  Form,
  JsSrc,
  TranspileError,
  isCuSymbol,
  aConst,
  aRecursiveConst,
  showSymbolAccess,
  markAsDirectWriter,
} from "../../../internal/types.js";

import { isNonExpressionCall } from "../common.js";
import { _cu$const } from "../safe.js";

export * from "../iteration.js";

export const _cu$while = markAsDirectWriter(
  async (
    env: Env,
    bool: Form,
    ...rest: Block
  ): Promise<JsSrc | TranspileError> => {
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

    EnvF.pushInherited(env);

    const statementsSrc = await transpileBlock(rest, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return `while(${boolSrc}){\n${statementsSrc}\n}`;
  },
);

export const _cu$for = markAsDirectWriter(
  async (
    env: Env,
    initialStatement: Form,
    bool: Form,
    final: Form,
    ...rest: Block
  ): Promise<JsSrc | TranspileError> => {
    EnvF.pushInherited(env);

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
  },
);

export const forEach = markAsDirectWriter(
  async (
    env: Env,
    id: Form,
    iterable: Form,
    ...statements: Block
  ): Promise<JsSrc | TranspileError> => {
    EnvF.pushInherited(env);

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
  },
);

export const recursive = markAsDirectWriter(
  async (env: Env, ...consts: Block): Promise<JsSrc | TranspileError> => {
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
      if (declName !== _cu$const) {
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
  },
);
