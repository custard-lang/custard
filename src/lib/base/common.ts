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
} from "../../internal/types.js";

import * as Iteration from "./iteration.js";
import * as Unbounded from "./iteration/unbounded.js";
import * as Safe from "./safe.js";
import * as Module from "./module.js";
import { pseudoTopLevelAssignment } from "../../internal/cu-env.js";

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
  f: (env: Env, id: CuSymbol, exp: JsSrc) => JsSrc | TranspileError,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (env: Env, id: Form, v: Form, another?: Form) => {
      if (another != null) {
        return new TranspileError(
          `The number of arguments to \`${formId}\` must be 2!`,
        );
      }
      if (!isCuSymbol(id)) {
        return new TranspileError(`${JSON.stringify(id)} is not a symbol!`);
      }

      const exp = await transpileExpression(v, env);
      if (exp instanceof TranspileError) {
        return exp;
      }
      return f(env, id, exp);
    },
  );
}

export function transpilingForVariableDeclaration(
  formId: Id,
  keyword: Id,
  newWriter: () => Writer,
): MarkedDirectWriter {
  return transpilingForAssignment(
    formId,
    (env: Env, id: CuSymbol, exp: JsSrc) => {
      if (EnvF.isDefinedInThisScope(env, id.v)) {
        return new TranspileError(
          `Variable ${JSON.stringify(id.v)} is already defined!`,
        );
      }
      const r = EnvF.set(env, id.v, newWriter());
      if (r instanceof TranspileError) {
        return r;
      }
      if (EnvF.isAtTopLevel(env) && env.transpileState.mode === "repl") {
        return pseudoTopLevelAssignment(id, exp);
      }
      return keyword === ""
        ? `${id.v} = ${exp}`
        : `${keyword} ${id.v} = ${exp}`;
    },
  );
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
