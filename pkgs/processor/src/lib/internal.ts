import {
  aConst,
  aVar,
  defaultAsyncScopeOptions,
  type DirectWriter,
  type DirectWriterKindFlags,
  type Context,
  exportableStatement,
  formatForError,
  type Id,
  isVar,
  type Ktval,
  type KtvalAssignDecl,
  ktvalAssignDestructuringArray,
  ktvalAssignDestructuringObject,
  ktvalAssignSimple,
  ktvalFunctionPostlude,
  ktvalOther,
  ktvalRefer,
  markAsDirectWriter,
  type MarkedDirectWriter,
  ordinaryExpression,
  ordinaryStatement,
  type ScopeOptions,
  TranspileError,
  type Writer,
  isMarkedDirectStatementWriter,
} from "../internal/types.js";
import {
  type CuSymbol,
  isCuArray,
  isCuObject,
  isCuSymbol,
  isKeyValue,
  isList,
  isUnquote,
  type JsSrc,
  type Ktvals,
  list,
  isSplice,
  CuArray,
} from "../types.js";
import {
  transpileComputedKeyOrExpression,
  transpileExpressionU,
  transpileExpressionsJoinWithCommaU,
  transpileStatementsJoinWithSemicolonU,
  transpileStatementWithWriterU,
} from "../internal/transpile.js";
import * as ContextF from "../internal/context.js";
import { ExpectNever } from "../util/error.js";
import { Awaitable } from "../util/types.js";

export function transpiling1Unmarked(
  formId: Id,
  f: (a: Ktvals<JsSrc>) => Ktvals<JsSrc>,
): (
  context: Context,
  a: unknown,
  ...unused: unknown[]
) => Promise<Ktvals<JsSrc> | TranspileError> {
  return async (
    context: Context,
    a?: unknown,
    ...unused: unknown[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (a === undefined || unused.length > 0) {
      return new TranspileError(
        `\`${formId}\` must receive exactly one expression!`,
      );
    }
    const ra = await transpileExpressionU(a, context);
    if (TranspileError.is(ra)) {
      return ra;
    }

    return f(ra);
  };
}

export function transpiling1(
  formId: Id,
  f: (a: Ktvals<JsSrc>) => Ktvals<JsSrc>,
  kind: DirectWriterKindFlags = ordinaryExpression,
): MarkedDirectWriter {
  return markAsDirectWriter(transpiling1Unmarked(formId, f), kind);
}

export function transpiling2(
  formId: Id,
  f: (
    a: Ktvals<JsSrc>,
    b: Ktvals<JsSrc>,
    ...unused: unknown[]
  ) => Ktvals<JsSrc>,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      context: Context,
      a?: unknown,
      b?: unknown,
      ...unused: unknown[]
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      if (a === undefined || b === undefined || unused.length !== 0) {
        return new TranspileError(
          `\`${formId}\` must receive exactly two expressions!`,
        );
      }

      const ra = await transpileExpressionU(a, context);
      if (TranspileError.is(ra)) {
        return ra;
      }

      const rb = await transpileExpressionU(b, context);
      if (TranspileError.is(rb)) {
        return rb;
      }

      return [ktvalOther("("), ...f(ra, rb), ktvalOther(")")];
    },
  );
}

export function transpilingFunctionArguments(
  f: (a: Ktvals<JsSrc>) => Ktvals<JsSrc>,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      context: Context,
      ...args: unknown[]
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      const argSrcs = await transpileExpressionsJoinWithCommaU(args, context);
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
  f: (
    context: Context,
    id: unknown,
    exp?: Ktvals<JsSrc>,
  ) => Awaitable<Ktvals<JsSrc> | TranspileError>,
  kind: DirectWriterKindFlags,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      context: Context,
      id: unknown,
      value?: unknown,
      another?: unknown,
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      if (another != null) {
        return new TranspileError(
          `The number of arguments to \`${formId}\` must be 2!`,
        );
      }

      if (value === undefined) {
        return await f(context, id);
      }

      const exp = await transpileExpressionU(value, context);
      if (TranspileError.is(exp)) {
        return exp;
      }
      return await f(context, id, exp);
    },
    kind,
  );
}

export function transpilingForVariableDeclaration(
  decl: KtvalAssignDecl,
  buildStatement: (
    assignee: JsSrc,
    exp?: Ktvals<JsSrc>,
  ) => Ktvals<JsSrc> | TranspileError,
  newWriter: () => Writer,
): MarkedDirectWriter {
  const formId = decl.trimEnd();
  return transpilingForAssignment(
    formId,
    async (
      context: Context,
      sym: unknown,
      exp?: Ktvals<JsSrc>,
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      let r: undefined | TranspileError;

      if (ContextF.isAtTopLevel(context)) {
        exp ??= [ktvalOther("void 0")];
        if (isCuSymbol(sym)) {
          r = tryToSet(sym, context, newWriter);
          if (TranspileError.is(r)) {
            return r;
          }
          return [ktvalAssignSimple(decl, sym.value, exp)];
        }

        if (isCuObject(sym)) {
          const assignDestructuringObject = ktvalAssignDestructuringObject(
            decl,
            [],
            null,
            exp,
          );
          for (const kvOrSymOrSplice of sym) {
            if (assignDestructuringObject.assigneeSplice !== null) {
              return new TranspileError(
                `Rest element must be last element in assignee of \`${formId}\`!`,
              );
            }
            if (isKeyValue(kvOrSymOrSplice)) {
              const { key, value } = kvOrSymOrSplice;

              let keyKtvals: Ktvals<JsSrc> | Id;
              if (isCuSymbol(key)) {
                keyKtvals = key.value;
              } else {
                const kSrc = await transpileComputedKeyOrExpression(
                  key,
                  context,
                );
                if (TranspileError.is(kSrc)) {
                  return kSrc;
                }
                keyKtvals = kSrc;
              }

              if (!isCuSymbol(value)) {
                const vFormatted = formatForError(value);
                return new TranspileError(
                  `The assignee of \`${formId}\` must be a Symbol, but ${vFormatted} is not!`,
                );
              }
              r = tryToSet(value, context, newWriter);
              if (TranspileError.is(r)) {
                return r;
              }
              assignDestructuringObject.assignee.push([keyKtvals, value.value]);
              continue;
            }

            if (isCuSymbol(kvOrSymOrSplice)) {
              r = tryToSet(kvOrSymOrSplice, context, newWriter);
              if (TranspileError.is(r)) {
                return r;
              }
              assignDestructuringObject.assignee.push(kvOrSymOrSplice.value);
              continue;
            }

            if (isSplice(kvOrSymOrSplice)) {
              const sym = kvOrSymOrSplice.value;
              if (!isCuSymbol(sym)) {
                const symFormatted = formatForError(sym);
                return new TranspileError(
                  `${formId}'s assignee must be a symbol, but ${symFormatted} is not!`,
                );
              }
              r = tryToSet(sym, context, newWriter);
              if (TranspileError.is(r)) {
                return r;
              }
              assignDestructuringObject.assigneeSplice = sym.value;
              continue;
            }

            if (isUnquote(kvOrSymOrSplice)) {
              return new TranspileError(
                "Unquote must be used inside quasiQuote",
              );
            }

            throw ExpectNever(kvOrSymOrSplice);
          }
          return [assignDestructuringObject];
        }

        if (isCuArray(sym)) {
          const assignDestructuringArray = ktvalAssignDestructuringArray(
            decl,
            [],
            exp,
          );
          for (const v of sym) {
            if (isCuSymbol(v)) {
              r = tryToSet(v, context, newWriter);
              if (TranspileError.is(r)) {
                return r;
              }
              assignDestructuringArray.assignee.push(v.value);
              continue;
            }
            const vFormatted = formatForError(v);
            return new TranspileError(
              `${formId}'s assignee must be a symbol, but ${vFormatted} is not!`,
            );
          }

          return [assignDestructuringArray];
        }

        const symFormatted = formatForError(sym);
        return new TranspileError(
          `${formId}'s assignee must be a symbol, but ${symFormatted} is not!`,
        );
      }

      const assignee = transpileLocalAssignee(formId, context, sym, newWriter);
      if (TranspileError.is(assignee)) {
        return assignee;
      }
      return buildStatement(assignee, exp);
    },
    exportableStatement,
  );
}

function transpileLocalAssignee(
  formId: Id,
  context: Context,
  sym: unknown,
  newWriter: () => Writer,
): JsSrc | TranspileError {
  if (isCuSymbol(sym)) {
    const r = tryToSet(sym, context, newWriter);
    if (TranspileError.is(r)) {
      return r;
    }
    return sym.value;
  }
  if (isCuObject(sym)) {
    let assignee = "{";
    let hasAssignedSplice = false;
    for (const kvOrSymOrSplice of sym) {
      if (hasAssignedSplice) {
        return new TranspileError(
          `Rest element must be last element in assignee of \`${formId}\`!`,
        );
      }

      if (isKeyValue(kvOrSymOrSplice)) {
        const { key, value } = kvOrSymOrSplice;
        if (!isCuSymbol(key)) {
          const kFormatted = formatForError(key);
          return new TranspileError(
            `${formId}'s assignee must be a symbol, but ${kFormatted} is not!`,
          );
        }

        const r = transpileLocalAssignee(formId, context, value, newWriter);
        if (TranspileError.is(r)) {
          return r;
        }

        assignee = `${assignee}${key.value}:${r},`;
        continue;
      }

      if (isCuSymbol(kvOrSymOrSplice)) {
        const r0 = tryToSet(kvOrSymOrSplice, context, newWriter);
        if (TranspileError.is(r0)) {
          return r0;
        }
        assignee = `${assignee}${kvOrSymOrSplice.value},`;
        continue;
      }

      if (isUnquote(kvOrSymOrSplice)) {
        return new TranspileError("Unquote must be used inside quasiQuote");
      }

      if (isSplice(kvOrSymOrSplice)) {
        const sym = kvOrSymOrSplice.value;
        if (!isCuSymbol(sym)) {
          const symFormatted = formatForError(sym);
          return new TranspileError(
            `${formId}'s assignee must be a symbol, but ${symFormatted} is not!`,
          );
        }
        hasAssignedSplice = true;
        const r = tryToSet(sym, context, newWriter);
        if (TranspileError.is(r)) {
          return r;
        }
        assignee = `${assignee}...${sym.value}`;
        continue;
      }

      throw ExpectNever(kvOrSymOrSplice);
    }
    return `${assignee}}`;
  }
  if (isCuArray(sym)) {
    return transpileArrayAssignee(formId, context, sym, newWriter);
  }
  const symFormatted = formatForError(sym);
  return new TranspileError(
    `${formId}'s assignee must be a symbol or an object literal, but ${symFormatted} is not!`,
  );
}

class TranspileLocalAssigneeSpliceAware {
  #hasEncounteredSplice: boolean;
  constructor() {
    this.#hasEncounteredSplice = false;
  }

  execute(
    formId: Id,
    context: Context,
    sym: unknown,
    newWriter: () => Writer,
  ): JsSrc | TranspileError {
    if (this.#hasEncounteredSplice) {
      return new TranspileError(
        `Rest element must be last element in assignee of \`${formId}\`!`,
      );
    }

    if (isSplice(sym)) {
      this.#hasEncounteredSplice = true;
      const symValue = sym.value;
      if (isCuArray(symValue)) {
        return transpileArrayAssignee(formId, context, symValue, newWriter);
      }
      if (isCuSymbol(symValue)) {
        const r = tryToSet(symValue, context, newWriter);
        if (TranspileError.is(r)) {
          return r;
        }
        return `...${symValue.value}`;
      }
      const symFormatted = formatForError(symValue);
      return new TranspileError(
        `${formId}'s assignee must be a symbol or array, but ${symFormatted} is not!`,
      );
    }

    const r = transpileLocalAssignee(formId, context, sym, newWriter);
    if (TranspileError.is(r)) {
      return r;
    }
    return `${r},`;
  }
}

function transpileArrayAssignee(
  formId: Id,
  context: Context,
  array: CuArray<unknown>,
  newWriter: () => Writer,
): JsSrc | TranspileError {
  let assignee = "[";
  const transpileElement = new TranspileLocalAssigneeSpliceAware();
  for (const form of array) {
    const r = transpileElement.execute(formId, context, form, newWriter);
    if (TranspileError.is(r)) {
      return r;
    }
    assignee = `${assignee}${r}`;
  }
  return `${assignee}]`;
}

export function tryToSet(
  sym: CuSymbol,
  context: Context,
  newWriter: () => Writer,
): undefined | TranspileError {
  if (ContextF.isDefinedInThisScope(context, sym.value)) {
    return new TranspileError(
      `Variable ${JSON.stringify(sym.value)} is already defined!`,
    );
  }
  const r = ContextF.set(context, sym.value, newWriter());
  if (TranspileError.is(r)) {
    return r;
  }
}

export function transpilingForVariableMutation(
  formId: Id,
  whenTopRepl: (jsExp: Ktval<JsSrc>) => Ktvals<JsSrc>,
  otherwise: (jsExp: JsSrc) => Ktvals<JsSrc>,
): MarkedDirectWriter {
  return markAsDirectWriter(
    (
      context: Context,
      sym: unknown,
      another?: unknown,
    ): Ktvals<JsSrc> | TranspileError => {
      if (another !== undefined) {
        return new TranspileError(
          `\`${formId}\` must receive only one symbol!`,
        );
      }

      if (!isCuSymbol(sym)) {
        return new TranspileError(
          `The argument to \`${formId}\` must be a name of a variable!`,
        );
      }

      const r = ContextF.resolveCuSymbol(context, sym);
      if (TranspileError.is(r)) {
        return r;
      }
      if (!isVar(r.writer)) {
        return new TranspileError(
          `\`${sym.value}\` is not a name of a variable declared by \`let\` or a mutable property!`,
        );
      }

      if (r.canBeAtPseudoTopLevel) {
        return [
          ktvalAssignSimple("", sym.value, whenTopRepl(ktvalRefer(sym.value))),
        ];
      }
      return otherwise(sym.value);
    },
    ordinaryStatement,
  );
}

interface PreludeResult {
  src: Ktvals<JsSrc>;
  readonly funName: CuSymbol | null;
  readonly firstBlock: unknown[];
}

function functionPrelude(
  formId: Id,
  context: Context,
  nameOrArgs: unknown,
  argsOrFirstForm: unknown,
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
): PreludeResult | TranspileError {
  if (nameOrArgs === undefined) {
    return new TranspileError(
      `No name or argument list is given to a \`${formId}\`!`,
    );
  }

  let funName: CuSymbol | null;
  let funNameInSrc: JsSrc;
  let firstBlock: unknown[];
  if (nameOrArgs === null) {
    funName = null;
    funNameInSrc = "";
    firstBlock = [];
  } else if (isCuSymbol(nameOrArgs)) {
    funName = nameOrArgs;
    funNameInSrc = ` ${funName.value}`;
    firstBlock = [];
  } else if (isList(nameOrArgs)) {
    funName = null;
    funNameInSrc = "";
    firstBlock = argsOrFirstForm == null ? [] : [argsOrFirstForm];
    argsOrFirstForm = nameOrArgs;
  } else {
    return new TranspileError(
      `The first argument to a function must be a symbol or a list of symbols!`,
    );
  }

  if (argsOrFirstForm === undefined) {
    return new TranspileError(`No argument list is given to a \`${formId}\`!`);
  }

  if (!isList(argsOrFirstForm)) {
    const argsFormatted = formatForError(argsOrFirstForm);
    return new TranspileError(
      `Arguments for a function must be a list of assignable expressions! But ${argsFormatted} is not!`,
    );
  }

  ContextF.push(context, scopeOptions);

  let argPatterns: JsSrc = "";
  const transpileLocalAssigneeSpliceAware =
    new TranspileLocalAssigneeSpliceAware();
  for (const arg of argsOrFirstForm) {
    const argSrc = transpileLocalAssigneeSpliceAware.execute(
      formId,
      context,
      arg,
      aVar,
    );
    if (TranspileError.is(argSrc)) {
      return argSrc;
    }
    argPatterns = `${argPatterns}${argSrc}`;
  }

  return {
    src: [ktvalOther(`${beforeArguments}${funNameInSrc}(${argPatterns}){\n`)],
    funName,
    firstBlock,
  };
}

function functionPostlude(
  context: Context,
  { src, funName }: PreludeResult,
): Ktvals<JsSrc> | TranspileError {
  ContextF.pop(context);
  if (funName !== null) {
    const r = tryToSet(funName, context, aConst);
    if (TranspileError.is(r)) {
      return r;
    }

    if (ContextF.isAtTopLevel(context)) {
      return [ktvalFunctionPostlude(funName.value, src)];
    }
  }
  return [...src, ktvalOther("}")];
}

export async function buildFn(
  formId: Id,
  context: Context,
  nameOrArgs: unknown | undefined | null,
  argsOrFirstForm: unknown | undefined,
  block: unknown[],
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const preludeResult = functionPrelude(
    formId,
    context,
    nameOrArgs,
    argsOrFirstForm,
    scopeOptions,
    beforeArguments,
  );
  if (TranspileError.is(preludeResult)) {
    return preludeResult;
  }

  block = [...preludeResult.firstBlock, ...block];
  const lastI = block.length - 1;
  const blockWithoutLast = block.slice(0, lastI);
  if (blockWithoutLast.length > 0) {
    const srcs = await transpileStatementsJoinWithSemicolonU(
      blockWithoutLast,
      context,
    );
    if (TranspileError.is(srcs)) {
      return srcs;
    }
    preludeResult.src.push(...srcs);
  }

  const lastStatement = block[lastI];
  if (lastStatement !== undefined) {
    const lastSrcWithWriter = await transpileStatementWithWriterU(
      lastStatement,
      context,
    );
    if (TranspileError.is(lastSrcWithWriter)) {
      return lastSrcWithWriter;
    }
    const [lastSrc, writer] = lastSrcWithWriter;
    if (writer !== null && isMarkedDirectStatementWriter(writer)) {
      preludeResult.src.push(ktvalOther(";\n"), ...lastSrc, ktvalOther(";\n"));
    } else {
      preludeResult.src.push(
        ktvalOther(";\nreturn "),
        ...lastSrc,
        ktvalOther(";\n"),
      );
    }
  }
  return functionPostlude(context, preludeResult);
}

export async function buildProcedure(
  formId: Id,
  context: Context,
  nameOrArgs: unknown | undefined,
  argsOrFirstForm: unknown | undefined,
  block: unknown[],
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const preludeResult = functionPrelude(
    formId,
    context,
    nameOrArgs,
    argsOrFirstForm,
    scopeOptions,
    beforeArguments,
  );
  if (TranspileError.is(preludeResult)) {
    return preludeResult;
  }

  block = [...preludeResult.firstBlock, ...block];
  const srcs = await transpileStatementsJoinWithSemicolonU(block, context);
  if (TranspileError.is(srcs)) {
    return srcs;
  }
  preludeResult.src.push(...srcs);

  return functionPostlude(context, preludeResult);
}

export function buildScope(
  formId: Id,
  prefix: string,
  scopeOptions: ScopeOptions,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      context: Context,
      ...block: unknown[]
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      const argsList = list();
      const funcSrc = await buildFn(
        formId,
        context,
        null,
        argsList,
        block,
        scopeOptions,
        "",
      );
      if (TranspileError.is(funcSrc)) {
        return funcSrc;
      }
      return [ktvalOther(`(${prefix}`), ...funcSrc, ktvalOther(")()")];
    },
  );
}

export function buildForEach(
  build: (
    assignee: JsSrc,
    iterableSrc: Ktvals<JsSrc>,
    statementsSrc: Ktvals<JsSrc>,
  ) => Ktvals<JsSrc>,
): DirectWriter {
  return async (
    context: Context,
    id?: unknown,
    iterable?: unknown,
    ...statements: unknown[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    ContextF.pushInherited(context);

    if (id === undefined) {
      return new TranspileError(
        "No variable name given to a `forEach` statement!",
      );
    }

    const assignee = transpileLocalAssignee("forEach", context, id, aConst);
    if (TranspileError.is(assignee)) {
      return assignee;
    }

    if (iterable === undefined) {
      return new TranspileError(
        "No iterable expression given to a `forEach` statement!",
      );
    }

    const iterableSrc = await transpileExpressionU(iterable, context);
    if (TranspileError.is(iterableSrc)) {
      return iterableSrc;
    }

    const statementsSrc = await transpileStatementsJoinWithSemicolonU(
      statements,
      context,
    );
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    ContextF.pop(context);

    return build(assignee, iterableSrc, statementsSrc);
  };
}

export async function buildAsyncFn(
  formId: Id,
  context: Context,
  name: unknown,
  argsOrFirstForm: unknown,
  block: unknown[],
): Promise<Ktvals<JsSrc> | TranspileError> {
  return await buildFn(
    formId,
    context,
    name,
    argsOrFirstForm,
    block,
    defaultAsyncScopeOptions,
    "async function",
  );
}
