import {
  aConst,
  aVar,
  type Block,
  defaultAsyncScopeOptions,
  type DirectWriter,
  type DirectWriterKindFlags,
  type Env,
  exportableStatement,
  type Form,
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
} from "../types.js";
import {
  transpileComputedKeyOrExpression,
  transpileExpression,
  transpileJoinWithComma,
  transpileStatements,
} from "../internal/transpile.js";
import * as EnvF from "../internal/env.js";
import { isStatement } from "../internal/call.js";

export function transpiling1Unmarked(
  formId: Id,
  f: (a: Ktvals<JsSrc>) => Ktvals<JsSrc>,
): (
  env: Env,
  a: Form,
  ...unused: Form[]
) => Promise<Ktvals<JsSrc> | TranspileError> {
  return async (
    env: Env,
    a: Form,
    ...unused: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
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
  f: (a: Ktvals<JsSrc>) => Ktvals<JsSrc>,
  kind: DirectWriterKindFlags = ordinaryExpression,
): MarkedDirectWriter {
  return markAsDirectWriter(transpiling1Unmarked(formId, f), kind);
}

export function transpiling2(
  formId: Id,
  f: (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>, ...unused: Form[]) => Ktvals<JsSrc>,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      env: Env,
      a: Form,
      b: Form,
      ...unused: Form[]
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
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

      return [ktvalOther("("), ...f(ra, rb), ktvalOther(")")];
    },
  );
}

export function transpilingFunctionArguments(
  f: (a: Ktvals<JsSrc>) => Ktvals<JsSrc>,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      env: Env,
      ...args: Form[]
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
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
  f: (
    env: Env,
    id: Form,
    exp?: Ktvals<JsSrc>,
  ) => Promise<Ktvals<JsSrc> | TranspileError>,
  kind: DirectWriterKindFlags = exportableStatement,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      env: Env,
      id: Form,
      value?: Form,
      another?: Form,
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      if (another != null) {
        return new TranspileError(
          `The number of arguments to \`${formId}\` must be 2!`,
        );
      }

      if (value === undefined) {
        return await f(env, id);
      }

      const exp = await transpileExpression(value, env);
      if (TranspileError.is(exp)) {
        return exp;
      }
      return await f(env, id, exp);
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
      env: Env,
      sym: Form,
      exp?: Ktvals<JsSrc>,
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      let r: undefined | TranspileError;

      if (EnvF.isAtTopLevel(env)) {
        exp ??= [ktvalOther("void 0")];
        if (isCuSymbol(sym)) {
          r = tryToSet(sym, env, newWriter);
          if (TranspileError.is(r)) {
            return r;
          }
          return [ktvalAssignSimple(decl, sym.value, exp)];
        }

        if (isCuObject(sym)) {
          const assignDestructuringObject = ktvalAssignDestructuringObject(
            decl,
            [],
            exp,
          );
          for (const kvOrSym of sym) {
            if (isKeyValue(kvOrSym)) {
              const { key, value } = kvOrSym;

              let keyKtvals: Ktvals<JsSrc> | Id;
              if (isCuSymbol(key)) {
                keyKtvals = key.value;
              } else {
                const kSrc = await transpileComputedKeyOrExpression(key, env);
                if (TranspileError.is(kSrc)) {
                  return kSrc;
                }
                keyKtvals = kSrc;
              }

              if (!isCuSymbol(value)) {
                const vFormatted = formatForError(value);
                return new TranspileError(
                  `${formId}'s assignee must be a symbol, but ${vFormatted} is not!`,
                );
              }
              r = tryToSet(value, env, newWriter);
              if (TranspileError.is(r)) {
                return r;
              }
              assignDestructuringObject.assignee.push([keyKtvals, value.value]);
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
            assignDestructuringObject.assignee.push(kvOrSym.value);
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
              r = tryToSet(v, env, newWriter);
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

      const assignee = transpileLocalAssignee(formId, env, sym, newWriter);
      if (TranspileError.is(assignee)) {
        return assignee;
      }
      return buildStatement(assignee, exp);
    },
  );
}

function transpileLocalAssignee(
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
    return sym.value;
  }
  if (isCuObject(sym)) {
    let assignee = "{";
    for (const kvOrSym of sym) {
      if (isKeyValue(kvOrSym)) {
        const { key, value } = kvOrSym;
        if (!isCuSymbol(key)) {
          const kFormatted = formatForError(key);
          return new TranspileError(
            `${formId}'s assignee must be a symbol, but ${kFormatted} is not!`,
          );
        }

        if (!isCuSymbol(value)) {
          const vFormatted = formatForError(value);
          return new TranspileError(
            `${formId}'s assignee must be a symbol, but ${vFormatted} is not!`,
          );
        }

        const r1 = tryToSet(value, env, newWriter);
        if (TranspileError.is(r1)) {
          return r1;
        }

        assignee = `${assignee}${key.value}:${value.value},`;
        continue;
      }

      if (isUnquote(kvOrSym)) {
        return new TranspileError("Unquote must be used inside quasiQuote");
      }

      const r0 = tryToSet(kvOrSym, env, newWriter);
      if (TranspileError.is(r0)) {
        return r0;
      }
      assignee = `${assignee}${kvOrSym.value},`;
    }
    return `${assignee}}`;
  }
  if (isCuArray(sym)) {
    let assignee = "[";
    for (const form of sym) {
      if (isCuSymbol(form)) {
        const r0 = tryToSet(form, env, newWriter);
        if (TranspileError.is(r0)) {
          return r0;
        }
        assignee = `${assignee}${form.value},`;
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

export function tryToSet(
  sym: CuSymbol,
  env: Env,
  newWriter: () => Writer,
): undefined | TranspileError {
  if (EnvF.isDefinedInThisScope(env, sym.value)) {
    return new TranspileError(
      `Variable ${JSON.stringify(sym.value)} is already defined!`,
    );
  }
  const r = EnvF.set(env, sym.value, newWriter());
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
    (env: Env, sym: Form, another?: Form): Ktvals<JsSrc> | TranspileError => {
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

      const r = EnvF.findWithIsAtTopLevel(env, sym);
      if (r === undefined || !isVar(r.writer)) {
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
  readonly firstBlock: Block;
}

function functionPrelude(
  formId: Id,
  env: Env,
  nameOrArgs: Form | undefined | null,
  argsOrFirstForm: Form | undefined,
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
  let firstBlock: Block;
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
      `Arguments for a function must be a list of symbols! But ${argsFormatted} is not!`,
    );
  }

  EnvF.push(env, scopeOptions);

  const argPatterns: JsSrc[] = [];
  for (const arg of argsOrFirstForm) {
    const argSrc = transpileLocalAssignee(formId, env, arg, aVar);
    if (TranspileError.is(argSrc)) {
      return argSrc;
    }
    argPatterns.push(argSrc);
  }

  return {
    src: [
      ktvalOther(
        `${beforeArguments}${funNameInSrc}(${argPatterns.join(", ")}){\n`,
      ),
    ],
    funName,
    firstBlock,
  };
}

function functionPostlude(
  env: Env,
  { src, funName }: PreludeResult,
): Ktvals<JsSrc> | TranspileError {
  EnvF.pop(env);
  if (funName !== null) {
    const r = tryToSet(funName, env, aConst);
    if (TranspileError.is(r)) {
      return r;
    }

    if (EnvF.isAtTopLevel(env)) {
      return [ktvalFunctionPostlude(funName.value, src)];
    }
  }
  return [...src, ktvalOther("}")];
}

export async function buildFn(
  formId: Id,
  env: Env,
  nameOrArgs: Form | undefined | null,
  argsOrFirstForm: Form | undefined,
  block: Block,
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const preludeResult = functionPrelude(
    formId,
    env,
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
  for (let i = 0; i < lastI; ++i) {
    // `i` is always less than `block.length` so it's safe to use `block[i]!`
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const src = await transpileExpression(block[i]!, env);
    if (TranspileError.is(src)) {
      return src;
    }
    preludeResult.src.push(ktvalOther("  "), ...src, ktvalOther(";\n"));
  }

  const lastStatement = block[lastI];
  if (lastStatement !== undefined) {
    const lastSrc = await transpileExpression(lastStatement, env);
    if (TranspileError.is(lastSrc)) {
      return lastSrc;
    }

    if (isStatement(env, lastStatement)) {
      preludeResult.src.push(ktvalOther("  "), ...lastSrc, ktvalOther(";\n"));
    } else {
      preludeResult.src.push(
        ktvalOther("  return "),
        ...lastSrc,
        ktvalOther(";\n"),
      );
    }
  }
  return functionPostlude(env, preludeResult);
}

export async function buildProcedure(
  formId: Id,
  env: Env,
  nameOrArgs: Form | undefined,
  argsOrFirstForm: Form | undefined,
  block: Block,
  scopeOptions: ScopeOptions,
  beforeArguments: JsSrc,
): Promise<Ktvals<JsSrc> | TranspileError> {
  const preludeResult = functionPrelude(
    formId,
    env,
    nameOrArgs,
    argsOrFirstForm,
    scopeOptions,
    beforeArguments,
  );
  if (TranspileError.is(preludeResult)) {
    return preludeResult;
  }

  block = [...preludeResult.firstBlock, ...block];
  for (const form of block) {
    const src = await transpileExpression(form, env);
    if (TranspileError.is(src)) {
      return src;
    }
    preludeResult.src.push(ktvalOther("  "), ...src, ktvalOther(";\n"));
  }

  return functionPostlude(env, preludeResult);
}

export function buildScope(
  formId: Id,
  prefix: string,
  scopeOptions: ScopeOptions,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
      env: Env,
      ...block: Block
    ): Promise<Ktvals<JsSrc> | TranspileError> => {
      const argsList = list();
      const funcSrc = await buildFn(
        formId,
        env,
        null,
        argsList as Form,
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
    env: Env,
    id?: Form,
    iterable?: Form,
    ...statements: Block
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    EnvF.pushInherited(env);

    if (id === undefined) {
      return new TranspileError(
        "No variable name given to a `forEach` statement!",
      );
    }

    const assignee = transpileLocalAssignee("forEach", env, id, aConst);
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

    const statementsSrc = await transpileStatements(statements, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }

    EnvF.pop(env);

    return build(assignee, iterableSrc, statementsSrc);
  };
}

export async function buildAsyncFn(
  formId: Id,
  env: Env,
  name: Form | undefined | null,
  argsOrFirstForm: Form | undefined,
  block: Form[],
): Promise<Ktvals<JsSrc> | TranspileError> {
  return await buildFn(
    formId,
    env,
    name,
    argsOrFirstForm,
    block,
    defaultAsyncScopeOptions,
    "async function",
  );
}
