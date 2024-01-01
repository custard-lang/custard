import * as EnvF from "../../../internal/env.js";
import {
  asCall,
  transpileBlock,
  transpileExpression,
} from "../../../internal/transpile.js";
import {
  aRecursiveConst,
  Block,
  Env,
  Form,
  isCuSymbol,
  JsSrc,
  markAsDirectWriter,
  ordinaryStatement,
  showSymbolAccess,
  TranspileError,
} from "../../../internal/types.js";

import { buildForEach, isStatement } from "../common.js";
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

    if (isStatement(env, bool)) {
      const id = showSymbolAccess(bool[0]);
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${id}\` is a statement!`,
      );
    }

    const boolSrc = await transpileExpression(bool, env);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }

    EnvF.pushInherited(env);

    const statementsSrc = await transpileBlock(rest, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return `while(${boolSrc}){${statementsSrc}}`;
  },
  ordinaryStatement,
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

    if (isStatement(env, bool)) {
      const id = showSymbolAccess(bool[0]);
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${id}\` is a statement!`,
      );
    }

    const initialStatementSrc = await transpileExpression(
      initialStatement,
      env,
    );
    if (TranspileError.is(initialStatementSrc)) {
      return initialStatementSrc;
    }
    const boolSrc = await transpileExpression(bool, env);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }
    const finalSrc = await transpileExpression(final, env);
    if (TranspileError.is(finalSrc)) {
      return finalSrc;
    }
    const statementsSrc = await transpileBlock(rest, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return `for(${initialStatementSrc};${boolSrc};${finalSrc}){${statementsSrc}}`;
  },
  ordinaryStatement,
);

export const forEach = markAsDirectWriter(
  buildForEach(
    (assignee: JsSrc, iterableSrc: JsSrc, statementsSrc: JsSrc): JsSrc =>
      `for(const ${assignee} of ${iterableSrc}){${statementsSrc}}`,
  ),
  ordinaryStatement,
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
      if (TranspileError.is(r)) {
        return r;
      }
    }

    return await transpileBlock(consts, env);
  },
  ordinaryStatement,
);
