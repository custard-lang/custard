import * as ContextF from "../../../internal/context.js";
import {
  transpileStatementsJoinWithSemicolonU,
  transpileStatementU,
  transpileExpressionU,
} from "../../../internal/transpile.js";
import {
  type Context,
  isCuSymbol,
  ktvalOther,
  type JsSrc,
  type Ktvals,
  markAsDirectWriter,
  functionIdOfCall,
  TranspileError,
} from "../../../types.js";
import {
  aRecursiveConst,
  formatForError,
  ordinaryStatement,
} from "../../../internal/types.js";
import { asCall, asStatement } from "../../../internal/call.js";

import { _cu$const } from "../safe.js";
import { buildForEach } from "../../internal.js";

export * from "../iteration.js";

export const _cu$while = markAsDirectWriter(
  async (
    context: Context,
    bool?: unknown,
    ...rest: unknown[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (bool === undefined) {
      return new TranspileError(
        "No conditional expression given to a `while` statement!",
      );
    }

    const stmt = asStatement(context, bool);
    if (TranspileError.is(stmt)) {
      return stmt;
    }
    if (stmt !== undefined) {
      const id = formatForError(functionIdOfCall(stmt));
      return new TranspileError(
        `The conditional expression in a \`while\` must be an expression! But \`${id}\` is a statement!`,
      );
    }

    const boolSrc = await transpileStatementU(bool, context);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }

    ContextF.pushInherited(context);

    const statementsSrc = await transpileStatementsJoinWithSemicolonU(
      rest,
      context,
    );
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    ContextF.pop(context);
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
    context: Context,
    initialStatement?: unknown,
    bool?: unknown,
    final?: unknown,
    ...rest: unknown[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    ContextF.pushInherited(context);

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

    const stmt = asStatement(context, bool);
    if (TranspileError.is(stmt)) {
      return stmt;
    }
    if (stmt !== undefined) {
      const id = formatForError(functionIdOfCall(stmt));
      return new TranspileError(
        `The conditional expression in a \`for\` must be an expression! But \`${id}\` is a statement!`,
      );
    }

    const initialStatementSrc = await transpileStatementU(
      initialStatement,
      context,
    );
    if (TranspileError.is(initialStatementSrc)) {
      return initialStatementSrc;
    }
    const boolSrc = await transpileExpressionU(bool, context);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }
    const finalSrc = await transpileStatementU(final, context);
    if (TranspileError.is(finalSrc)) {
      return finalSrc;
    }
    const statementsSrc = await transpileStatementsJoinWithSemicolonU(
      rest,
      context,
    );
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    ContextF.pop(context);
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
    context: Context,
    ...consts: unknown[]
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
      const declName = ContextF.find(context, functionIdOfCall(call));
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
      const r = ContextF.set(context, id.value, aRecursiveConst());
      if (TranspileError.is(r)) {
        return r;
      }
    }

    return await transpileStatementsJoinWithSemicolonU(consts, context);
  },
  ordinaryStatement,
);
