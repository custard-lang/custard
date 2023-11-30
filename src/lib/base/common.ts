import * as EnvF from "../../internal/env.js";
import { asCall, transpileExpression } from "../../internal/transpile.js";
import {
  aVar,
  Block,
  Call,
  CuSymbol,
  ordinaryExpression,
  DirectWriterKindFlags,
  Env,
  exportableStatement,
  Form,
  Id,
  isCuSymbol,
  isLiteralObject,
  isMarkedDirectStatementWriter,
  isVar,
  JsSrc,
  LiteralObject,
  markAsDirectWriter,
  MarkedDirectWriter,
  ordinaryStatement,
  TranspileError,
  Writer,
  ScopeOptions,
} from "../../internal/types.js";

import {
  pseudoTopLevelAssignment,
  pseudoTopLevelReference,
} from "../../internal/cu-env.js";

export function isStatement(env: Env, form: Form): form is Call {
  return isCallOf(env, form, isMarkedDirectStatementWriter);
}

export function isExportableStatement(env: Env, form: Form): form is Call {
  return isCallOf(env, form, isMarkedDirectStatementWriter);
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
  const w = EnvF.find(env, call[0]);
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

      return f(ra, rb);
    },
  );
}

// TODO: Handle assignment to reserved words etc.
export function transpilingForAssignment(
  formId: Id,
  f: (
    env: Env,
    id: CuSymbol | LiteralObject,
    exp: JsSrc,
  ) => Promise<JsSrc | TranspileError>,
  kind: DirectWriterKindFlags = exportableStatement,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, id: Form, v: Form, another?: Form) => {
      if (another != null) {
        return new TranspileError(
          `The number of arguments to \`${formId}\` must be 2!`,
        );
      }
      if (!isCuSymbol(id) && !isLiteralObject(id)) {
        return new TranspileError(
          `${JSON.stringify(id)} is must be a symbol or key values of symbols!`,
        );
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
  buildStatement: (assignee: JsSrc, exp: JsSrc) => JsSrc,
  newWriter: () => Writer,
): MarkedDirectWriter {
  return transpilingForAssignment(
    formId,
    async (env: Env, sym: CuSymbol | LiteralObject, exp: JsSrc) => {
      let r: undefined | TranspileError;

      if (EnvF.isAtReplTopLevel(env)) {
        if (isCuSymbol(sym)) {
          r = tryToSet(sym, env, newWriter);
          if (TranspileError.is(r)) {
            return r;
          }
          return pseudoTopLevelAssignment(sym.v, exp);
        }
        const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
        let src = statement;
        for (const kvOrSym of sym.v) {
          if (isCuSymbol(kvOrSym)) {
            r = tryToSet(kvOrSym, env, newWriter);
            if (TranspileError.is(r)) {
              return r;
            }
            const expDotId = `${tmpVar}.${kvOrSym.v}`;
            src = `${src}\n${pseudoTopLevelAssignment(kvOrSym.v, expDotId)};`;
            continue;
          }
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
            const vJson = JSON.stringify(v);
            return new TranspileError(
              `${formId}'s assignee must be a symbol, but ${vJson} is not!`,
            );
          }
          r = tryToSet(v, env, newWriter);
          if (TranspileError.is(r)) {
            return r;
          }
          src = `${src}\n${pseudoTopLevelAssignment(v.v, expDotId)};`;
        }
        return src;
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
      if (isCuSymbol(kvOrSym)) {
        const r0 = tryToSet(kvOrSym, env, newWriter);
        if (TranspileError.is(r0)) {
          return r0;
        }
        assignee = `${assignee}${`${kvOrSym.v},`}`;
        continue;
      }

      const [k, v] = kvOrSym;
      if (!isCuSymbol(k)) {
        const vJson = JSON.stringify(v);
        return new TranspileError(
          `${formId}'s assignee must be a symbol, but ${vJson} is not!`,
        );
      }

      if (!isCuSymbol(v)) {
        const vJson = JSON.stringify(v);
        return new TranspileError(
          `${formId}'s assignee must be a symbol, but ${vJson} is not!`,
        );
      }

      const r1 = tryToSet(v, env, newWriter);
      if (TranspileError.is(r1)) {
        return r1;
      }

      assignee = `${assignee}${k.v}:${v.v},`;
    }
    return `${assignee}}`;
  }
  const symJson = JSON.stringify(sym);
  return new TranspileError(
    `${formId}'s assignee must be a symbol or an object literal, but ${symJson} is not!`,
  );
}

function tryToSet(
  sym: CuSymbol,
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

    const r = EnvF.findWithIsAtTopLevel(env, sym.v);
    // TODO: Support namespace?
    if (r === undefined || !isVar(r.writer)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable declared by \`let\`!`,
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
  if (!(args instanceof Array)) {
    return new TranspileError(
      `Arguments for a function must be a list of symbols! But actually ${JSON.stringify(
        args,
      )}`,
    );
  }

  EnvF.push(env, scopeOptions);

  const argPatterns: JsSrc[] = [];
  for (const arg of args) {
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
    const src = await transpileExpression(block[i], env);
    if (TranspileError.is(src)) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }

  const lastStatement = block[lastI];
  const lastSrc = await transpileExpression(lastStatement, env);
  if (TranspileError.is(lastSrc)) {
    return lastSrc;
  }

  if (isStatement(env, lastStatement)) {
    return functionPostlude(env, `${result}  ${lastSrc};\n  return;\n`);
  }
  return functionPostlude(env, `${result}  return ${lastSrc};\n`);
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
    const src = await transpileExpression(block[i], env);
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
        [],
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
