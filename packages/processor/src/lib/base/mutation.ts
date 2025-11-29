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
import { transpileComputedKeyOrExpression } from "../../internal/transpile.js";
import { isUnquote } from "../../internal/types/unquote.js";
import { isCuArray } from "../../internal/types/cu-array.js";
import { isPropertyAccess } from "../../types.js";

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
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (exp === undefined) {
      return new TranspileError(
        "No expression given to an `assign` statement!",
      );
    }

    function assignStatement(
      sym: CuSymbol,
      e: Ktvals<JsSrc>,
    ): Ktvals<JsSrc> | TranspileError {
      const r = ContextF.findWithIsAtTopLevel(context, sym);
      if (r === undefined || !isVar(r.writer)) {
        return new TranspileError(
          `\`${sym.value}\` is not a name of a variable declared by \`let\` or a mutable property!`,
        );
      }
      if (r.canBeAtPseudoTopLevel) {
        return [ktvalAssignSimple("", sym.value, e)];
      }
      return [ktvalOther(`${sym.value}=`), ...e];
    }

    if (isCuSymbol(id)) {
      return assignStatement(id, exp);
    }

    if (isCuObject(id)) {
      const { id: tmpVar, statement } = ContextF.tmpVarOf(context, exp);
      const src = statement;
      for (const kvOrSym of id) {
        if (isKeyValue(kvOrSym)) {
          const { key, value } = kvOrSym;
          if (!isCuSymbol(value)) {
            return new TranspileError(
              `Assignee must be a symbol, but ${formatForError(value)} is not!`,
            );
          }

          let assignment: Ktvals<JsSrc> | TranspileError;
          if (isCuSymbol(key)) {
            assignment = assignStatement(value, [
              ktvalOther(`${tmpVar}.${key.value}`),
            ]);
          } else {
            const kSrc = await transpileComputedKeyOrExpression(key, context);
            if (TranspileError.is(kSrc)) {
              return kSrc;
            }
            assignment = assignStatement(value, [ktvalOther(tmpVar), ...kSrc]);
          }
          if (TranspileError.is(assignment)) {
            return assignment;
          }
          src.push(...assignment, ktvalOther("\n"));

          continue;
        }

        if (isUnquote(kvOrSym)) {
          return new TranspileError("Unquote must be used inside quasiQuote");
        }

        const assignment = assignStatement(kvOrSym, [
          ktvalOther(`${tmpVar}.${kvOrSym.value}`),
        ]);
        if (TranspileError.is(assignment)) {
          return assignment;
        }
        src.push(...assignment, ktvalOther("\n"));
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
      if (r === undefined || !isVar(r.writer)) {
        return new TranspileError(
          `\`${id0}\` is not a name of a variable declared by \`let\` or a mutable property!`,
        );
      }
      if (r.canBeAtPseudoTopLevel) {
        return [ktvalRefer(id0), ktvalOther(`.${ids.join(".")}=`), ...exp];
      }
      return [ktvalOther(`.${value.join(".")}=`), ...exp];
    }

    const vFormatted = formatForError(id);
    return new TranspileError(
      `assign's assignee must be a symbol, but ${vFormatted} is not!`,
    );
  },
  ordinaryExpression,
);
