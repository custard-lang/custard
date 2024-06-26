import * as EnvF from "../../internal/env.js";
import {
  asCall,
  transpileBlock,
  transpileExpression,
  transpileJoinWithComma,
} from "../../internal/transpile.js";
import {
  aVar,
  type Block,
  type Call,
  type LiteralCuSymbol,
  ordinaryExpression,
  type DirectWriterKindFlags,
  type Env,
  exportableStatement,
  type Form,
  type Id,
  isCuSymbol,
  isLiteralObject,
  isMarkedDirectStatementWriter,
  isVar,
  type JsSrc,
  markAsDirectWriter,
  type MarkedDirectWriter,
  ordinaryStatement,
  TranspileError,
  type Writer,
  type ScopeOptions,
  aConst,
  isMarkedDirectExportableStatementWriter,
  type DirectWriter,
  isLiteralArray,
  isKeyValue,
  unknownLocation,
  emptyList,
  formatForError,
  isUnquote,
} from "../../internal/types.js";

import {
  pseudoTopLevelAssignment,
  pseudoTopLevelReference,
} from "../../internal/cu-env.js";

export function isStatement(env: Env, form: Form): form is Call {
  return isCallOf(env, form, isMarkedDirectStatementWriter);
}

export function isExportableStatement(env: Env, form: Form): form is Call {
  return isCallOf(env, form, isMarkedDirectExportableStatementWriter);
}

function isCallOf(
  env: Env,
  form: Form,
  p: (w: Writer) => boolean,
): form is Call {
  const call = asCall(form);
  if (call === undefined) {
    return false;
  }
  const w = EnvF.find(env, call.v[0]);
  // TODO: More helpful error if the writer is not found
  return w !== undefined && p(w);
}

export function transpiling1Unmarked(
  formId: Id,
  f: (a: JsSrc) => JsSrc,
): (env: Env, a: Form, ...unused: Form[]) => Promise<JsSrc | TranspileError> {
  return async (
    env: Env,
    a: Form,
    ...unused: Form[]
  ): Promise<JsSrc | TranspileError> => {
    const ra = await transpileExpression(a, env);
    if (TranspileError.is(ra)) {
      return ra;
    }

    if (unused.length > 0) {
      return new TranspileError(
        `\`${formId}\` must receive exactly one expression!`,
      );
    }

    return f(ra);
  };
}

export function transpiling1(
  formId: Id,
  f: (a: JsSrc) => JsSrc,
  kind: DirectWriterKindFlags = ordinaryExpression,
): MarkedDirectWriter {
  return markAsDirectWriter(transpiling1Unmarked(formId, f), kind);
}

export function transpiling2(
  formId: Id,
  f: (a: JsSrc, b: JsSrc, ...unused: Form[]) => JsSrc,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      env: Env,
      a: Form,
      b: Form,
      ...unused: Form[]
    ): Promise<JsSrc | TranspileError> => {
      const ra = await transpileExpression(a, env);
      if (TranspileError.is(ra)) {
        return ra;
      }

      const rb = await transpileExpression(b, env);
      if (TranspileError.is(rb)) {
        return rb;
      }

      if (unused.length > 0) {
        return new TranspileError(
          `\`${formId}\` must receive exactly one expression!`,
        );
      }

      return `(${f(ra, rb)})`;
    },
  );
}

export function transpilingFunctionArguments(
  f: (a: JsSrc) => JsSrc,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
      const argSrcs = await transpileJoinWithComma(args, env);
      if (TranspileError.is(argSrcs)) {
        return argSrcs;
      }
      return f(argSrcs);
    },
  );
}

// TODO: Handle assignment to reserved words etc.
export function transpilingForAssignment(
  formId: Id,
  f: (env: Env, id: Form, exp?: JsSrc) => Promise<JsSrc | TranspileError>,
  kind: DirectWriterKindFlags = exportableStatement,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, id: Form, v?: Form, another?: Form) => {
      if (another != null) {
        return new TranspileError(
          `The number of arguments to \`${formId}\` must be 2!`,
        );
      }

      if (v === undefined) {
        return await f(env, id);
      }

      const exp = await transpileExpression(v, env);
      if (TranspileError.is(exp)) {
        return exp;
      }
      return await f(env, id, exp);
    },
    kind,
  );
}

export function transpilingForVariableDeclaration(
  formId: Id,
  buildStatement: (assignee: JsSrc, exp?: JsSrc) => JsSrc | TranspileError,
  newWriter: () => Writer,
): MarkedDirectWriter {
  return transpilingForAssignment(
    formId,
    async (env: Env, sym: Form, exp?: JsSrc) => {
      let r: undefined | TranspileError;

      if (EnvF.isAtReplTopLevel(env)) {
        exp ??= "void 0";
        if (isCuSymbol(sym)) {
          r = tryToSet(sym, env, newWriter);
          if (TranspileError.is(r)) {
            return r;
          }
          return pseudoTopLevelAssignment(sym.v, exp);
        }

        if (isLiteralObject(sym)) {
          const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
          let src = statement;
          for (const kvOrSym of sym.v) {
            if (isKeyValue(kvOrSym)) {
              const [k, v] = kvOrSym;

              let expDotId: JsSrc | TranspileError;
              if (isCuSymbol(k)) {
                expDotId = `${tmpVar}.${k.v}`;
              } else {
                // TODO: expect k is an LiteralArray
                const kSrc = await transpileExpression(k, env);
                if (TranspileError.is(kSrc)) {
                  return kSrc;
                }
                expDotId = `${tmpVar}${kSrc}`;
              }

              if (!isCuSymbol(v)) {
                const vFormatted = formatForError(v);
                return new TranspileError(
                  `${formId}'s assignee must be a symbol, but ${vFormatted} is not!`,
                );
              }
              r = tryToSet(v, env, newWriter);
              if (TranspileError.is(r)) {
                return r;
              }
              src = `${src}\n${pseudoTopLevelAssignment(v.v, expDotId)};`;
              continue;
            }

            if (isUnquote(kvOrSym)) {
              return new TranspileError(
                "Unquote must be used inside quasiQuote",
              );
            }

            r = tryToSet(kvOrSym, env, newWriter);
            if (TranspileError.is(r)) {
              return r;
            }
            const expDotId = `${tmpVar}.${kvOrSym.v}`;
            src = `${src}\n${pseudoTopLevelAssignment(kvOrSym.v, expDotId)};`;
          }
          return src;
        }

        if (isLiteralArray(sym)) {
          const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
          let src = statement;
          for (const [k, v] of sym.v.entries()) {
            if (isCuSymbol(v)) {
              r = tryToSet(v, env, newWriter);
              if (TranspileError.is(r)) {
                return r;
              }
              const expDotId = `${tmpVar}[${k}]`;
              src = `${src}\n${pseudoTopLevelAssignment(v.v, expDotId)};`;
              continue;
            }
            const vFormatted = formatForError(v);
            return new TranspileError(
              `${formId}'s assignee must be a symbol, but ${vFormatted} is not!`,
            );
          }

          return src;
        }

        const symFormatted = formatForError(sym);
        return new TranspileError(
          `${formId}'s assignee must be a symbol, but ${symFormatted} is not!`,
        );
      }

      const assignee = transpileAssignee(formId, env, sym, newWriter);
      if (TranspileError.is(assignee)) {
        return assignee;
      }
      return buildStatement(assignee, exp);
    },
  );
}

export function transpileAssignee(
  formId: Id,
  env: Env,
  sym: Form,
  newWriter: () => Writer,
): JsSrc | TranspileError {
  if (isCuSymbol(sym)) {
    const r = tryToSet(sym, env, newWriter);
    if (TranspileError.is(r)) {
      return r;
    }
    return sym.v;
  }
  if (isLiteralObject(sym)) {
    let assignee = "{";
    for (const kvOrSym of sym.v) {
      if (isKeyValue(kvOrSym)) {
        const [k, v] = kvOrSym;
        if (!isCuSymbol(k)) {
          const kFormatted = formatForError(k);
          return new TranspileError(
            `${formId}'s assignee must be a symbol, but ${kFormatted} is not!`,
          );
        }

        if (!isCuSymbol(v)) {
          const vFormatted = formatForError(v);
          return new TranspileError(
            `${formId}'s assignee must be a symbol, but ${vFormatted} is not!`,
          );
        }

        const r1 = tryToSet(v, env, newWriter);
        if (TranspileError.is(r1)) {
          return r1;
        }

        assignee = `${assignee}${k.v}:${v.v},`;
        continue;
      }

      if (isUnquote(kvOrSym)) {
        return new TranspileError("Unquote must be used inside quasiQuote");
      }

      const r0 = tryToSet(kvOrSym, env, newWriter);
      if (TranspileError.is(r0)) {
        return r0;
      }
      assignee = `${assignee}${`${kvOrSym.v},`}`;
    }
    return `${assignee}}`;
  }
  if (isLiteralArray(sym)) {
    let assignee = "[";
    for (const form of sym.v) {
      if (isCuSymbol(form)) {
        const r0 = tryToSet(form, env, newWriter);
        if (TranspileError.is(r0)) {
          return r0;
        }
        assignee = `${assignee}${`${form.v},`}`;
        continue;
      }

      const formFormatted = formatForError(form);
      return new TranspileError(
        `${formId}'s assignee must be a symbol, but ${formFormatted} is not!`,
      );
    }
    return `${assignee}]`;
  }
  const symFormatted = formatForError(sym);
  return new TranspileError(
    `${formId}'s assignee must be a symbol or an object literal, but ${symFormatted} is not!`,
  );
}

function tryToSet(
  sym: LiteralCuSymbol,
  env: Env,
  newWriter: () => Writer,
): undefined | TranspileError {
  if (EnvF.isDefinedInThisScope(env, sym.v)) {
    return new TranspileError(
      `Variable ${JSON.stringify(sym.v)} is already defined!`,
    );
  }
  const r = EnvF.set(env, sym.v, newWriter());
  if (TranspileError.is(r)) {
    return r;
  }
}

export function transpilingForVariableMutation(
  formId: Id,
  whenTopRepl: (jsExp: JsSrc) => JsSrc,
  otherwise: (jsExp: JsSrc) => JsSrc,
): MarkedDirectWriter {
  return markAsDirectWriter((env: Env, sym: Form, another?: Form) => {
    if (another !== undefined) {
      return new TranspileError(`\`${formId}\` must receive only one symbol!`);
    }

    if (!isCuSymbol(sym)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable!`,
      );
    }

    const r = EnvF.findWithIsAtTopLevel(env, sym);
    if (r === undefined || !isVar(r.writer)) {
      return new TranspileError(
        `\`${sym.v}\` is not a name of a variable declared by \`let\` or a mutable property!`,
      );
    }

    if (EnvF.writerIsAtReplTopLevel(env, r)) {
      return pseudoTopLevelAssignment(
        sym.v,
        whenTopRepl(pseudoTopLevelReference(sym.v)),
      );
    }
    return otherwise(sym.v);
  }, ordinaryStatement);
}

function functionPrelude(
  formId: Id,
  env: Env,
  args: Form,
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
  afterArguments: JsSrc,
): JsSrc | TranspileError {
  if (args.t !== "List") {
    const argsFormatted = formatForError(args);
    return new TranspileError(
      `Arguments for a function must be a list of symbols! But ${argsFormatted} is not!`,
    );
  }

  EnvF.push(env, scopeOptions);

  const argPatterns: JsSrc[] = [];
  for (const arg of args.v) {
    const argSrc = transpileAssignee(formId, env, arg, aVar);
    if (TranspileError.is(argSrc)) {
      return argSrc;
    }
    argPatterns.push(argSrc);
  }

  return `${beforeArguments}(${argPatterns.join(", ")})${afterArguments}{\n`;
}

function functionPostlude(env: Env, src: JsSrc): JsSrc {
  EnvF.pop(env);
  return `${src}}`;
}

export async function buildFn(
  formId: Id,
  env: Env,
  args: Form,
  block: Block,
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
  afterArguments: JsSrc,
): Promise<JsSrc | TranspileError> {
  let result = functionPrelude(
    formId,
    env,
    args,
    scopeOptions,
    beforeArguments,
    afterArguments,
  );
  if (TranspileError.is(result)) {
    return result;
  }

  const lastI = block.length - 1;
  for (let i = 0; i < lastI; ++i) {
    // `i` is always less than `block.length` so it's safe to use `block[i]!`
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const src = await transpileExpression(block[i]!, env);
    if (TranspileError.is(src)) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }

  const lastStatement = block[lastI];
  if (lastStatement !== undefined) {
    const lastSrc = await transpileExpression(lastStatement, env);
    if (TranspileError.is(lastSrc)) {
      return lastSrc;
    }

    if (isStatement(env, lastStatement)) {
      return functionPostlude(env, `${result}  ${lastSrc};\n`);
    }
    return functionPostlude(env, `${result}  return ${lastSrc};\n`);
  }
  return functionPostlude(env, result);
}

export async function buildProcedure(
  formId: Id,
  env: Env,
  args: Form,
  block: Block,
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
  afterArguments: JsSrc,
): Promise<JsSrc | TranspileError> {
  let result = functionPrelude(
    formId,
    env,
    args,
    scopeOptions,
    beforeArguments,
    afterArguments,
  );
  if (TranspileError.is(result)) {
    return result;
  }

  for (let i = 0; i < block.length; ++i) {
    // `i` is always less than `block.length` so it's safe to use `block[i]!`
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const src = await transpileExpression(block[i]!, env);
    if (TranspileError.is(src)) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }

  return functionPostlude(env, result);
}

export function buildScope(
  formId: Id,
  prefix: string,
  scopeOptions: ScopeOptions,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, ...block: Block): Promise<JsSrc | TranspileError> => {
      const funcSrc = await buildFn(
        formId,
        env,
        emptyList(unknownLocation),
        block,
        scopeOptions,
        "",
        "=>",
      );
      if (TranspileError.is(funcSrc)) {
        return funcSrc;
      }
      return `${`(${prefix}`}${funcSrc})()`;
    },
  );
}

export function buildForEach(
  build: (assignee: JsSrc, iterableSrc: JsSrc, statementsSrc: JsSrc) => JsSrc,
): DirectWriter {
  return async (
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

    const assignee = transpileAssignee("forEach", env, id, aConst);
    if (TranspileError.is(assignee)) {
      return assignee;
    }

    if (iterable === undefined) {
      return new TranspileError(
        "No iterable expression given to a `forEach` statement!",
      );
    }

    const iterableSrc = await transpileExpression(iterable, env);
    if (TranspileError.is(iterableSrc)) {
      return iterableSrc;
    }

    const statementsSrc = await transpileBlock(statements, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    EnvF.pop(env);

    return build(assignee, iterableSrc, statementsSrc);
  };
}

export function constructorFor(id: Id, arity: number): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
      if (args.length > arity) {
        const argsFormatted = args.map((arg) => formatForError(arg)).join(", ");
        return new TranspileError(
          `Too many arguments to \`${id}\` (${argsFormatted})`,
        );
      }
      const argsSrc = await transpileJoinWithComma(args, env);
      if (TranspileError.is(argsSrc)) {
        return argsSrc;
      }
      return `new ${id}(${argsSrc})`;
    },
  );
}
