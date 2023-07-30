import * as EnvF from "../../internal/env.js";
import {
  asCall,
  concatJsModules,
  extendBody,
  jsModuleOfBody,
  transpileExpression,
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
  isLiteralObject,
  LiteralObject,
  JsModule,
  isMarkedDirectStatementWriter,
  DirectWriterKind,
} from "../../internal/types.js";

import {
  pseudoTopLevelAssignment,
  pseudoTopLevelReference,
} from "../../internal/cu-env.js";
import { expectNever } from "../../util/error.js";

export function isStatement(env: Env, form: Form): form is Call {
  const call = asCall(form);
  if (call === undefined) {
    return false;
  }
  const w = EnvF.find(env, call[0]);
  return w !== undefined && isMarkedDirectStatementWriter(w);
}

export function transpiling1Unmarked(
  formId: Id,
  f: (a: JsModule) => JsModule,
): (
  env: Env,
  a: Form,
  ...unused: Form[]
) => Promise<JsModule | TranspileError> {
  return async (
    env: Env,
    a: Form,
    ...unused: Form[]
  ): Promise<JsModule | TranspileError> => {
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
  f: (a: JsModule) => JsModule,
): MarkedDirectWriter {
  return markAsDirectWriter(transpiling1Unmarked(formId, f));
}

export function transpiling2(
  f: (a: JsModule, b: JsModule) => JsModule,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, a: Form, b: Form): Promise<JsModule | TranspileError> => {
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
    id: CuSymbol | LiteralObject,
    exp: JsModule,
  ) => Promise<JsModule | TranspileError>,
  kind: DirectWriterKind = "statement",
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
      if (exp instanceof TranspileError) {
        return exp;
      }
      return await f(env, id, exp);
    },
    kind,
  );
}

export function transpilingForVariableDeclaration(
  formId: Id,
  buildStatement: (assignee: JsModule, exp: JsModule) => JsModule,
  newWriter: () => Writer,
): MarkedDirectWriter {
  return transpilingForAssignment(
    formId,
    async (env: Env, sym: CuSymbol | LiteralObject, exp: JsModule) => {
      let r: undefined | TranspileError;
      function tryToSet(sym: CuSymbol): undefined | TranspileError {
        if (EnvF.isDefinedInThisScope(env, sym.v)) {
          return new TranspileError(
            `Variable ${JSON.stringify(sym.v)} is already defined!`,
          );
        }
        const r = EnvF.set(env, sym.v, newWriter());
        if (r instanceof TranspileError) {
          return r;
        }
      }

      if (EnvF.isAtReplTopLevel(env)) {
        if (isCuSymbol(sym)) {
          r = tryToSet(sym);
          if (r instanceof TranspileError) {
            return r;
          }
          return pseudoTopLevelAssignment(sym.v, exp);
        }
        const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
        let src = statement;
        for (const kvOrSym of sym.v) {
          if (isCuSymbol(kvOrSym)) {
            r = tryToSet(kvOrSym);
            if (r instanceof TranspileError) {
              return r;
            }
            const expDotId = `${tmpVar}.${kvOrSym.v}`;
            src = concatJsModules(
              src,
              jsModuleOfBody("\n"),
              pseudoTopLevelAssignment(kvOrSym.v, jsModuleOfBody(expDotId)),
              jsModuleOfBody(";"),
            );
            continue;
          }
          const [k, v] = kvOrSym;

          let expDotId: JsModule | TranspileError;
          if (isCuSymbol(k)) {
            expDotId = jsModuleOfBody(`${tmpVar}.${k.v}`);
          } else {
            // TODO: expect k is an LiteralArray
            const kSrc = await transpileExpression(k, env);
            if (kSrc instanceof TranspileError) {
              return kSrc;
            }
            expDotId = extendBody(kSrc, tmpVar);
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
          src = concatJsModules(
            src,
            jsModuleOfBody("\n"),
            pseudoTopLevelAssignment(v.v, expDotId),
          );
        }
        return src;
      }

      let assignee: JsModule;
      if (isCuSymbol(sym)) {
        r = tryToSet(sym);
        if (r instanceof TranspileError) {
          return r;
        }
        assignee = jsModuleOfBody(sym.v);
      } else if (isLiteralObject(sym)) {
        assignee = jsModuleOfBody("{");
        for (const kvOrSym of sym.v) {
          if (isCuSymbol(kvOrSym)) {
            r = tryToSet(kvOrSym);
            if (r instanceof TranspileError) {
              return r;
            }
            assignee = extendBody(assignee, `${kvOrSym.v},`);
            continue;
          }
          const [k, v] = sym.v;
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
          assignee = concatJsModules(
            assignee,
            kSrc,
            jsModuleOfBody(`:${v.v},`),
          );
        }
        assignee = extendBody(assignee, "", "}");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return expectNever(sym);
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
        jsModuleOfBody(whenTopRepl(pseudoTopLevelReference(sym.v))),
      );
    }
    return jsModuleOfBody(otherwise(sym.v));
  }, "statement");
}

function functionPrelude(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
  isAsync: boolean,
): JsModule | TranspileError {
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

  return jsModuleOfBody(`(${argNames.join(", ")}) => {\n`);
}

function functionPostlude(env: Env, src: JsModule): JsModule {
  EnvF.pop(env);
  return extendBody(src, "", "}");
}

export async function buildFn(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
  isAsync = false,
): Promise<JsModule | TranspileError> {
  let result = functionPrelude(env, formId, args, block, isAsync);
  if (result instanceof TranspileError) {
    return result;
  }

  const lastI = block.length - 1;
  for (let i = 0; i < lastI; ++i) {
    const src = await transpileExpression(block[i], env);
    if (src instanceof TranspileError) {
      return src;
    }
    result = concatJsModules(
      result,
      jsModuleOfBody("  "),
      src,
      jsModuleOfBody(";\n"),
    );
  }

  const lastStatement = block[lastI];
  if (isStatement(env, lastStatement)) {
    const id = showSymbolAccess(lastStatement[0]);
    return new TranspileError(
      `The last statement in a \`${formId}\` must be an expression! But \`${id}\` is a statement!`,
    );
  }
  const lastSrc = await transpileExpression(lastStatement, env);
  if (lastSrc instanceof TranspileError) {
    return lastSrc;
  }
  result = concatJsModules(
    result,
    jsModuleOfBody("  return "),
    lastSrc,
    jsModuleOfBody(";\n"),
  );

  return functionPostlude(env, result);
}

export async function buildProcedure(
  env: Env,
  formId: Id,
  args: Form,
  block: Block,
  isAsync = false,
): Promise<JsModule | TranspileError> {
  let result = functionPrelude(env, formId, args, block, isAsync);
  if (result instanceof TranspileError) {
    return result;
  }

  for (let i = 0; i < block.length; ++i) {
    const src = await transpileExpression(block[i], env);
    if (src instanceof TranspileError) {
      return src;
    }
    result = concatJsModules(
      result,
      jsModuleOfBody("  "),
      src,
      jsModuleOfBody(";\n"),
    );
  }

  return functionPostlude(env, result);
}

export function buildScope(
  prefix: string,
  id: Id,
  isAsync = false,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, ...block: Block): Promise<JsModule | TranspileError> => {
      // EnvF.push(env);

      const funcSrc = await buildFn(env, id, [], block, isAsync);
      if (funcSrc instanceof TranspileError) {
        return funcSrc;
      }
      // EnvF.pop(env);
      return extendBody(funcSrc, `(${prefix}`, ")()");
    },
  );
}
