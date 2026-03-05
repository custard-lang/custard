import {
  transpilingForAssignment,
  transpilingForVariableDeclaration,
} from "../internal.js";
import {
  aVar,
  type Context,
  type Form,
  formatForError,
  isVar,
  JsSrc,
  ordinaryExpression,
  TranspileError,
} from "../../internal/types.js";
import {
  ktvalAssignSimple,
  ktvalOther,
  ktvalRefer,
  Ktvals,
} from "../../internal/types/ktval.js";
import { CuSymbol, isCuSymbol } from "../../internal/types/cu-symbol.js";
import * as ContextF from "../../internal/context.js";
import { isCuObject } from "../../internal/types/cu-object.js";
import { isKeyValue } from "../../internal/types/key-value.js";
import { isUnquote } from "../../internal/types/unquote.js";
import { isCuArray } from "../../internal/types/cu-array.js";
import { isPropertyAccess, isSplice } from "../../types.js";
import { ExpectNever } from "../../util/error.js";

export const _cu$let = transpilingForVariableDeclaration(
  "let ",
  (assignee: JsSrc, exp?: Ktvals<JsSrc>): Ktvals<JsSrc> =>
    exp === undefined
      ? [ktvalOther(`let ${assignee}`)]
      : [ktvalOther(`let ${assignee}`), ktvalOther("="), ...exp],
  aVar,
);
export const assign = transpilingForAssignment(
  "assign",
  async (
    context: Context,
    id: Form,
    exp?: Ktvals<JsSrc>,
    // This function must return a Promise. It'll need to call transpile*** functions which are async.
    // eslint-disable-next-line @typescript-eslint/require-await
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (exp === undefined) {
      return new TranspileError(
        "No expression given to an `assign` statement!",
      );
    }

    // NOTE:
    // Unlike `transpilingForVariableDeclaration` in internal.ts, which is used
    // for `let` and `const`, `assign` implements destructuring assignment by
    // combining `ktvalAssignSimple`, instead of using
    // `ktvalAssignDestructuringArray` or `ktvalAssignDestructuringObject`.
    // This is because it's easier to support the case where the assignee
    // variable is at the top-level which is defined as an entry of the
    // `_cu$c.transpileState.topLevelValues` Map in the REPL context.
    function assignStatement(
      sym: CuSymbol,
      e: Ktvals<JsSrc>,
    ): Ktvals<JsSrc> | TranspileError {
      const r = isPseudoTopLevelAsAssignableSymbol(sym);
      if (TranspileError.is(r)) {
        return r;
      }
      if (r) {
        return [ktvalAssignSimple("", sym.value, e)];
      }
      return [ktvalOther(`${sym.value}=`), ...e];
    }

    function isPseudoTopLevelAsAssignableSymbol(
      sym: CuSymbol,
    ): boolean | TranspileError {
      const r = ContextF.findWithIsAtTopLevel(context, sym);
      if (TranspileError.is(r)) {
        return r;
      }
      if (!isVar(r.writer)) {
        return new TranspileError(
          `\`${sym.value}\` is not a name of a variable declared by \`let\` or a mutable property!`,
        );
      }
      return r.canBeAtPseudoTopLevel;
    }

    if (isCuSymbol(id)) {
      return assignStatement(id, exp);
    }

    if (isCuObject(id)) {
      let hasAssignedSplice = false;
      const assignedKeys: string[] = [];
      const { id: tmpVar, statement } = ContextF.tmpVarOf(context, exp);
      const src = statement;
      for (const kvOrSymOrSplice of id) {
        if (hasAssignedSplice) {
          return new TranspileError(
            "Rest element must be last element in assignee of `assign` !",
          );
        }

        if (isKeyValue(kvOrSymOrSplice)) {
          const { key, value } = kvOrSymOrSplice;
          if (!isCuSymbol(value)) {
            return new TranspileError(
              `Assignee must be a symbol, but ${formatForError(value)} is not!`,
            );
          }

          if (!isCuSymbol(key)) {
            return new TranspileError(
              `Keys in assignee object must be symbols (non-symbols are not supported yet!), but ${formatForError(key)} is not!`,
            );
          }
          const assignment = assignStatement(value, [
            ktvalOther(`${tmpVar}.${key.value}`),
          ]);
          if (TranspileError.is(assignment)) {
            return assignment;
          }
          assignedKeys.push(key.value);
          src.push(...assignment, ktvalOther("\n"));

          continue;
        }

        if (isCuSymbol(kvOrSymOrSplice)) {
          const assignment = assignStatement(kvOrSymOrSplice, [
            ktvalOther(`${tmpVar}.${kvOrSymOrSplice.value}`),
          ]);
          if (TranspileError.is(assignment)) {
            return assignment;
          }
          assignedKeys.push(kvOrSymOrSplice.value);
          src.push(...assignment, ktvalOther("\n"));
          continue;
        }

        if (isSplice(kvOrSymOrSplice)) {
          const sym = kvOrSymOrSplice.value;
          if (!isCuSymbol(sym)) {
            const symFormatted = formatForError(sym);
            return new TranspileError(
              `assign's assignee must be a symbol, but ${symFormatted} is not!`,
            );
          }
          const isPseudoTopLevelAsAssignable =
            isPseudoTopLevelAsAssignableSymbol(sym);
          if (TranspileError.is(isPseudoTopLevelAsAssignable)) {
            return isPseudoTopLevelAsAssignable;
          }

          let initAssignee: Ktvals<JsSrc>;
          let assignBody: Ktvals<JsSrc>;
          if (isPseudoTopLevelAsAssignable) {
            initAssignee = [
              ktvalAssignSimple("", sym.value, [ktvalOther("{}")]),
            ];
            assignBody = [
              ktvalRefer(sym.value),
              ktvalOther(`[_cu$key]=_cu$value;\n`),
            ];
          } else {
            initAssignee = [ktvalOther(`${sym.value}=`), ktvalOther("{}")];
            assignBody = [ktvalOther(`${sym.value}[_cu$key]=_cu$value;\n`)];
          }

          hasAssignedSplice = true;
          src.push(
            ...initAssignee,
            ktvalOther(
              `for(const [_cu$key,_cu$value] of Object.entries(${tmpVar})){`,
            ),
            ktvalOther(
              `if(!${JSON.stringify(assignedKeys)}.includes(_cu$key)){`,
            ),
            ...assignBody,
            ktvalOther(`}}\n`),
          );
          continue;
        }

        if (isUnquote(kvOrSymOrSplice)) {
          return new TranspileError("Unquote must be used inside quasiQuote");
        }

        throw ExpectNever(kvOrSymOrSplice);
      }
      return src;
    }

    if (isCuArray(id)) {
      const { id: tmpVar, statement } = ContextF.tmpVarOf(context, exp);
      const src = statement;
      for (const [k, v] of id.entries()) {
        if (isCuSymbol(v)) {
          const assignment = assignStatement(v, [
            ktvalOther(`${tmpVar}[${k}]`),
          ]);
          if (TranspileError.is(assignment)) {
            return assignment;
          }
          src.push(...assignment, ktvalOther("\n"));
          continue;
        }
        const vFormatted = formatForError(v);
        return new TranspileError(
          `assign's assignee must be a symbol, but ${vFormatted} is not!`,
        );
      }
      return src;
    }

    if (isPropertyAccess(id)) {
      const { value } = id;
      const r = ContextF.findWithIsAtTopLevel(context, id);
      const [id0, ...ids] = value;
      if (TranspileError.is(r)) {
        return r;
      }
      if (r.canBeAtPseudoTopLevel) {
        return [ktvalRefer(id0), ktvalOther(`.${ids.join(".")}=`), ...exp];
      }
      return [ktvalOther(`${value.join(".")}=`), ...exp];
    }

    const vFormatted = formatForError(id);
    return new TranspileError(
      `assign's assignee must be a symbol, but ${vFormatted} is not!`,
    );
  },
  ordinaryExpression,
);
