import { assertNonNull, expectNever, mapAE } from "../util/error.js";

import {
  Block,
  Call,
  CuSymbol,
  Form,
  Id,
  isContextualKeyword,
  isVar,
  isCuSymbol,
  JsSrc,
  TranspileError,
  Writer,
  isConst,
  isRecursiveConst,
  isPropertyAccess,
  showSymbolAccess,
  markAsDirectWriter,
  MarkedDirectWriter,
  isNamespace,
  isMarkedFunctionWithEnv,
  isMarkedDirectWriter,
  KeyValues,
} from "../types.js";
import { Env } from "./types.js";
import * as EnvF from "./env.js";

export async function transpileStatement(
  ast: Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  const { transpileState } = env;
  switch (transpileState.mode) {
    case "repl":
      const { awaitingId } = transpileState;
      if (awaitingId !== undefined && EnvF.isAtTopLevel(env)) {
        const restSrc = await transpileExpression(ast, env);
        if (restSrc instanceof TranspileError) {
          return restSrc;
        }
        const promiseIdS = `"_cu$promise_${awaitingId}"`;
        const result = `_cu$env.transpileState.topLevelValues.get(${promiseIdS}).then((${awaitingId}) => {\nreturn ${restSrc}\n})`;
        transpileState.awaitingId = undefined;
        return result;
      }
    case "module":
      return await transpileExpression(ast, env);
  }
}

export async function transpileExpression(
  ast: Form,
  env: Env,
): Promise<JsSrc | TranspileError> {
  async function buildJsSrc(
    funcExpSrc: JsSrc,
    args: Form[],
  ): Promise<JsSrc | TranspileError> {
    const argSrcs = await mapAE(
      args,
      TranspileError,
      async (arg) => await transpileExpression(arg, env),
    );
    if (argSrcs instanceof TranspileError) {
      return argSrcs;
    }
    return `${funcExpSrc}(${argSrcs.join(", ")})`;
  }

  if (ast instanceof Array) {
    const [sym, ...args] = ast;

    if (isCall(sym)) {
      const funcSrc = await transpileExpression(sym, env);
      if (funcSrc instanceof TranspileError) {
        return funcSrc;
      }

      return await buildJsSrc(`(${funcSrc})`, args);
    }

    let fullId: Id;
    if (isCuSymbol(sym)) {
      fullId = sym.v;
    } else if (isPropertyAccess(sym)) {
      fullId = sym.v.join(".");
    } else {
      return new TranspileError(`${JSON.stringify(sym)} is not a symbol!`);
    }
    const f = EnvF.referTo(env, sym);
    if (f instanceof TranspileError) {
      return f;
    }

    if (isContextualKeyword(f)) {
      return new TranspileError(
        `\`${showSymbolAccess(sym)}\` must be used with \`${f.companion}\`!`,
      );
    }
    if (isNamespace(f)) {
      return new TranspileError(
        `\`${showSymbolAccess(
          sym,
        )}\` is just a namespace. Doesn't represent a function!`,
      );
    }

    if (isVar(f) || isConst(f) || isRecursiveConst(f)) {
      return await buildJsSrc(fullId, args);
    }
    if (isMarkedFunctionWithEnv(f)) {
      return await EnvF.enablingCuEnv(env, async (cuEnv) => {
        return await buildJsSrc(`${fullId}.call`, [cuEnv, ...args]);
      });
    }

    if (isMarkedDirectWriter(f)) {
      const r = f.call(env, ...args);
      if (r instanceof Promise) {
        return await r;
      }
      return r;
    }

    return expectNever(f) as JsSrc;
  }

  let r: Writer | TranspileError;
  switch (typeof ast) {
    case "string":
      return JSON.stringify(ast);
    case "undefined":
      return "void 0";
    case "number":
      return `${ast}`;
    case "boolean":
      return ast ? "!0" : "!1";
    case "object":
      switch (ast.t) {
        case "Symbol":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          return ast.v;
        case "PropertyAccess":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          return ast.v.join(".");
        case "KeyValues":
          return await transpileKeyValues(ast, env);
        case "Integer32":
          return `${ast.v}`;
      }
    default:
      return expectNever(ast) as JsSrc;
  }
}

async function transpileKeyValues(
  ast: KeyValues,
  env: Env,
): Promise<JsSrc | TranspileError> {
  let objectContents = "";
  for (const kv of ast.v) {
    let kvSrc: string;
    if (isCuSymbol(kv)) {
      const f = EnvF.referTo(env, kv);
      if (f instanceof TranspileError) {
        return f;
      }
      kvSrc = kv.v;
    } else {
      const [k, v] = kv;
      const kSrc = isCuSymbol(k) ? k.v : await transpileExpression(k, env);
      if (kSrc instanceof TranspileError) {
        return kSrc;
      }

      const vSrc = await transpileExpression(v, env);
      if (vSrc instanceof TranspileError) {
        return vSrc;
      }

      kvSrc = `${kSrc}: ${vSrc}`;
    }
    objectContents = `${objectContents}${kvSrc}, `;
  }
  return `{ ${objectContents} }`;
}

export async function transpileBlock(
  forms: Block,
  env: Env,
): Promise<JsSrc | TranspileError> {
  let jsSrc = "";
  for (const form of forms) {
    const s = await transpileStatement(form, env);
    if (s instanceof Error) {
      return s;
    }
    jsSrc = `${jsSrc}${s};\n`;
  }
  return jsSrc;
}

export function transpiling1(
  formId: Id,
  f: (a: JsSrc) => JsSrc,
): MarkedDirectWriter {
  return markAsDirectWriter(
    async (
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
    },
  );
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

export function transpilingForVariableMutation(
  formId: Id,
  operator: JsSrc,
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

    const val = EnvF.find(env, id.v);
    if (val === undefined || !isVar(val)) {
      return new TranspileError(
        `The argument to \`${formId}\` must be a name of a variable declared by \`let\`!`,
      );
    }

    return `${id.v}${operator}`;
  });
}

function isCall(form: Form): form is Call {
  return (
    form instanceof Array && (isCuSymbol(form[0]) || isPropertyAccess(form[0]))
  );
}

export function asCall(form: Form): [Id, ...Form[]] | undefined {
  if (!(form instanceof Array)) {
    return;
  }
  const id = form[0];
  if (isCuSymbol(id)) {
    return [id.v, ...form.slice(1)];
  }
  if (isPropertyAccess(id)) {
    const msg = "Assertion failure: an empty PropertyAccess";
    return [assertNonNull(id.v[0], msg), ...form.slice(1)];
  }
}
