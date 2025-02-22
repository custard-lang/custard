import * as EnvF from "../../../internal/env.js";
import {
  transpileStatements,
  transpileExpression,
} from "../../../internal/transpile.js";
import {
  type Block,
  type Env,
  type Form,
  isCuSymbol,
  ktvalOther,
  type JsSrc,
  type Ktvals,
  markAsDirectWriter,
  showSymbolAccess,
  functionIdOfCall,
  TranspileError,
} from "../../../types.js";
import { aRecursiveConst, ordinaryStatement } from "../../../internal/types.js";
import { asCall, isStatement } from "../../../internal/call.js";

import { _cu$const } from "../safe.js";
import { buildForEach } from "../../internal.js";

export * from "../iteration.js";

export const _cu$while = markAsDirectWriter(
  async (
    env: Env,
    bool?: Form,
    ...rest: Block
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (bool === undefined) {
      return new TranspileError(
        "No conditional expression given to a `while` statement!",
      );
    }

    if (isStatement(env, bool)) {
      const id = showSymbolAccess(functionIdOfCall(bool));
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${id}\` is a statement!`,
      );
    }

    const boolSrc = await transpileExpression(bool, env);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }

    EnvF.pushInherited(env);

    const statementsSrc = await transpileStatements(rest, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return [
      ktvalOther("while("),
      ...boolSrc,
      ktvalOther("){"),
      ...statementsSrc,
      ktvalOther("}"),
    ];
  },
  ordinaryStatement,
);

export const _cu$for = markAsDirectWriter(
  async (
    env: Env,
    initialStatement?: Form,
    bool?: Form,
    final?: Form,
    ...rest: Block
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
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
      const id = showSymbolAccess(functionIdOfCall(bool));
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
    const statementsSrc = await transpileStatements(rest, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    EnvF.pop(env);
    return [
      ktvalOther("for("),
      ...initialStatementSrc,
      ktvalOther(";"),
      ...boolSrc,
      ktvalOther(";"),
      ...finalSrc,
      ktvalOther("){"),
      ...statementsSrc,
      ktvalOther("}"),
    ];
  },
  ordinaryStatement,
);

export const forEach = markAsDirectWriter(
  buildForEach(
    (
      assignee: JsSrc,
      iterableSrc: Ktvals<JsSrc>,
      statementsSrc: Ktvals<JsSrc>,
    ): Ktvals<JsSrc> => [
      ktvalOther(`for (const ${assignee} of `),
      ...iterableSrc,
      ktvalOther("){"),
      ...statementsSrc,
      ktvalOther("}"),
    ],
  ),
  ordinaryStatement,
);

export const recursive = markAsDirectWriter(
  async (
    env: Env,
    ...consts: Block
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
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
      const declName = EnvF.find(env, functionIdOfCall(call));
      if (declName !== _cu$const) {
        return new TranspileError(
          "All declarations in `recursive` must be `const`!",
        );
      }

      const id = call.values[1];
      if (id === undefined) {
        return new TranspileError(`No variable name given to a \`const\`!`);
      }
      if (!isCuSymbol(id)) {
        return new TranspileError(`${JSON.stringify(id)} is not a symbol!`);
      }
      const r = EnvF.set(env, id.value, aRecursiveConst());
      if (TranspileError.is(r)) {
        return r;
      }
    }

    return await transpileStatements(consts, env);
  },
  ordinaryStatement,
);
