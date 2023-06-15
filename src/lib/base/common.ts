import * as EnvF from "../../internal/env.js";
import {
  asCall,
  transpileExpression,
  transpileStatement,
} from "../../internal/transpile.js";
import {
  Env,
  aVar,
  Block,
  Call,
  CuSymbol,
  Form,
  Id,
  isCuSymbol,
  JsSrc,
  markAsDirectWriter,
  MarkedDirectWriter,
  showSymbolAccess,
  TranspileError,
  Writer,
  isVar,
  isKeyValues,
  KeyValues,
} from "../../internal/types.js";

import * as Iteration from "./iteration.js";
import * as Unbounded from "./iteration/unbounded.js";
import * as Safe from "./safe.js";
import * as Module from "./module.js";
import {
  pseudoTopLevelAssignment,
  pseudoTopLevelReference,
} from "../../internal/cu-env.js";
import { expectNever } from "../../util/error.js";

export function isNonExpressionCall(env: Env, form: Form): form is Call {
  const call = asCall(form);
  if (call === undefined) {
    return false;
  }
  const nonExpressions: (Writer | undefined)[] = [
    Safe._cu$const,
    Safe._cu$let,
    Safe._cu$return,
    Safe.incrementF,
    Safe.decrementF,
    Safe.when,
    Unbounded._cu$while,
    Unbounded._cu$for,
    Unbounded.forEach,
    Unbounded.recursive,
    Iteration._cu$break,
    Iteration._cu$continue,
    Module._cu$import,
  ];
  return nonExpressions.includes(EnvF.find(env, call[0]));
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
    if (ra instanceof TranspileError) {
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
): MarkedDirectWriter {
  return markAsDirectWriter(transpiling1Unmarked(formId, f));
}

export function transpiling2(
  f: (a: JsSrc, b: JsSrc) => JsSrc,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, a: Form, b: Form): Promise<JsSrc | TranspileError> => {
      const ra = await transpileExpression(a, env);
      if (ra instanceof TranspileError) {
        return ra;
      }

      const rb = await transpileExpression(b, env);
      if (rb instanceof TranspileError) {
        return rb;
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
    id: CuSymbol | KeyValues,
    exp: JsSrc,
  ) => Promise<JsSrc | TranspileError>,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, id: Form, v: Form, another?: Form) => {
      if (another != null) {
        return new TranspileError(
          `The number of arguments to \`${formId}\` must be 2!`,
        );
      }
      if (!isCuSymbol(id) && !isKeyValues(id)) {
        return new TranspileError(
          `${JSON.stringify(id)} is must be a symbol or key values of symbols!`,
        );
      }

      const exp = await transpileExpression(v, env);
      if (exp instanceof TranspileError) {
        return exp;
      }
      return await f(env, id, exp);
    },
  );
}

export function transpilingForVariableDeclaration(
  formId: Id,
  buildStatement: (assignee: JsSrc, exp: JsSrc) => JsSrc,
  newWriter: () => Writer,
): MarkedDirectWriter {
  return transpilingForAssignment(
    formId,
    async (env: Env, id: CuSymbol | KeyValues, exp: JsSrc) => {
      let r: undefined | TranspileError;
      function tryToSet(id: CuSymbol): undefined | TranspileError {
        if (EnvF.isDefinedInThisScope(env, id.v)) {
          return new TranspileError(
            `Variable ${JSON.stringify(id.v)} is already defined!`,
          );
        }
        const r = EnvF.set(env, id.v, newWriter());
        if (r instanceof TranspileError) {
          return r;
        }
      }

      if (EnvF.isAtReplTopLevel(env)) {
        if (isCuSymbol(id)) {
          r = tryToSet(id);
          if (r instanceof TranspileError) {
            return r;
          }
          return pseudoTopLevelAssignment(id, exp);
        }
        const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
        let src = statement;
        for (const kvOrSym of id.v) {
          if (isCuSymbol(kvOrSym)) {
            r = tryToSet(kvOrSym);
            if (r instanceof TranspileError) {
              return r;
            }
            const expDotId = `${tmpVar}.${kvOrSym.v}`;
            src = `${src}\n${pseudoTopLevelAssignment(kvOrSym, expDotId)};`;
            continue;
          }
          const [k, v] = kvOrSym;

          let expDotId: JsSrc | TranspileError;
          if (isCuSymbol(k)) {
            expDotId = `${tmpVar}.${k.v}`;
          } else {
            const kSrc = await transpileExpression(k, env);
            if (kSrc instanceof TranspileError) {
              return kSrc;
            }
            expDotId = `${tmpVar}${kSrc}`;
          }

          if (!isCuSymbol(v)) {
            return new TranspileError(
              `${formId}'s assignee must be a symbol, but ${JSON.stringify(
                v,
              )} is not!`,
            );
          }
          r = tryToSet(v);
          if (r instanceof TranspileError) {
            return r;
          }
          src = `${src}\n${pseudoTopLevelAssignment(v, expDotId)};`;
        }
        return src;
      }

      let assignee: JsSrc;
      if (isCuSymbol(id)) {
        r = tryToSet(id);
        if (r instanceof TranspileError) {
          return r;
        }
        assignee = id.v;
      } else if (isKeyValues(id)) {
        assignee = "{";
        for (const kvOrSym of id.v) {
          if (isCuSymbol(kvOrSym)) {
            r = tryToSet(kvOrSym);
            if (r instanceof TranspileError) {
              return r;
            }
            assignee = `${assignee}${kvOrSym.v},`;
            continue;
          }
          const [k, v] = id.v;
          const kSrc = await transpileExpression(k, env);
          if (kSrc instanceof TranspileError) {
            return kSrc;
          }
          if (!isCuSymbol(v)) {
            return new TranspileError(
              `${formId}'s assignee must be a symbol, but ${JSON.stringify(
                v,
              )} is not!`,
            );
          }
          r = tryToSet(v);
          if (r instanceof TranspileError) {
            return r;
          }
          assignee = `${assignee}${kSrc}:${v.v},`;
        }
        assignee = `${assignee}}`;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return expectNever(id);
      }
      return buildStatement(assignee, exp);
    },
  );
}

export function transpilingForVariableMutation(
  formId: Id,
  whenTopRepl: (jsExp: JsSrc) => JsSrc,
  otherwise: (jsExp: JsSrc) => JsSrc,
): MarkedDirectWriter {
  return markAsDirectWriter((env: Env, id: Form, another?: Form) => {
    if (another !== undefined) {
      return new TranspileError(`\`${formId}\` must receive only one symbol!`);
    }

    if (!isCuSymbol(id)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable!`,
      );
    }

    const r = EnvF.findWithIsAtTopLevel(env, id.v);
    // TODO: Support namespace?
    if (r === undefined || !isVar(r.writer)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable declared by \`let\`!`,
      );
    }

    if (EnvF.writerIsAtReplTopLevel(env, r)) {
      return pseudoTopLevelAssignment(
        id,
        whenTopRepl(pseudoTopLevelReference(id)),
      );
    }
    return otherwise(id.v);
  });
}

function functionPrelude(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
  isAsync: boolean,
): JsSrc | TranspileError {
  if (!(args instanceof Array)) {
    return new TranspileError(
      `Arguments for a function must be an array of symbols! But actually ${JSON.stringify(
        args,
      )}`,
    );
  }
  if (block.length < 1) {
    return new TranspileError(
      `\`${formId}\` must receive at least one expression!`,
    );
  }

  EnvF.push(env, isAsync);

  const argNames = [];
  for (const arg of args) {
    if (!isCuSymbol(arg)) {
      return new TranspileError(
        `Arguments for a function must be an array of symbols! But actually ${JSON.stringify(
          args,
        )}`,
      );
    }
    const r = EnvF.set(env, arg.v, aVar());
    if (r instanceof TranspileError) {
      return r;
    }
    argNames.push(arg.v);
  }

  return `(${argNames.join(", ")}) => {\n`;
}

function functionPostlude(env: Env, src: JsSrc): JsSrc {
  EnvF.pop(env);
  return `${src}}`;
}

export async function buildFn(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
  isAsync = false,
): Promise<JsSrc | TranspileError> {
  let result = functionPrelude(env, formId, args, block, isAsync);
  if (result instanceof TranspileError) {
    return result;
  }

  const lastI = block.length - 1;
  for (let i = 0; i < lastI; ++i) {
    const src = await transpileStatement(block[i], env);
    if (src instanceof TranspileError) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }

  const lastStatement = block[lastI];
  if (isNonExpressionCall(env, lastStatement)) {
    const id = showSymbolAccess(lastStatement[0]);
    return new TranspileError(
      `The last statement in a \`${formId}\` must be an expression! But \`${id}\` is a statement!`,
    );
  }
  const lastSrc = await transpileStatement(lastStatement, env);
  if (lastSrc instanceof TranspileError) {
    return lastSrc;
  }
  result = `${result}  return ${lastSrc};\n`;

  return functionPostlude(env, result);
}

export async function buildProcedure(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
  isAsync = false,
): Promise<JsSrc | TranspileError> {
  let result = functionPrelude(env, formId, args, block, isAsync);
  if (result instanceof TranspileError) {
    return result;
  }

  for (let i = 0; i < block.length; ++i) {
    const src = await transpileStatement(block[i], env);
    if (src instanceof TranspileError) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }

  return functionPostlude(env, result);
}

export function buildScope(
  prefix: string,
  id: Id,
  isAsync = false,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, ...block: Block): Promise<JsSrc | TranspileError> => {
      // EnvF.push(env);

      const funcSrc = await buildFn(env, id, [], block, isAsync);
      if (funcSrc instanceof TranspileError) {
        return funcSrc;
      }
      // EnvF.pop(env);
      return `(${prefix}${funcSrc})()`;
    },
  );
}
