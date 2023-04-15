import { assertNonNull, mapAE } from "../../util/error.js";

import * as EnvF from "../../internal/env.js";
import {
  aConst,
  aContextualKeyword,
  aVar,
  Block,
  CuSymbol,
  Env,
  Form,
  isConst,
  isCuSymbol,
  JsSrc,
  TranspileError,
  markAsDirectWriter,
} from "../../internal/types.js";
import {
  transpileExpression,
  transpileBlock,
  transpilingForVariableMutation,
} from "../../internal/transpile.js";

import {
  buildFn,
  buildProcedure,
  buildScope,
  transpiling1,
  transpiling2,
  transpilingForAssignment,
} from "./common.js";

export const _cu$const = transpilingForAssignment(
  "const",
  (env: Env, id: CuSymbol, exp: JsSrc) => {
    if (EnvF.isDefinedInThisScope(env, id.v)) {
      return new TranspileError(
        `Variable ${JSON.stringify(id.v)} is already defined!`,
      );
    }
    const r = EnvF.set(env, id.v, aConst());
    if (r instanceof TranspileError) {
      return r;
    }
    return `const ${id.v} = ${exp}`;
  },
);

export const _cu$let = transpilingForAssignment(
  "let",
  (env: Env, id: CuSymbol, exp: JsSrc) => {
    if (EnvF.isDefinedInThisScope(env, id.v)) {
      return new TranspileError(
        `Variable ${JSON.stringify(id.v)} is already defined!`,
      );
    }
    const r = EnvF.set(env, id.v, aVar());
    if (r instanceof TranspileError) {
      return r;
    }
    return `let ${id.v} = ${exp}`;
  },
);

export const _cu$else = aContextualKeyword("if");

export const _cu$return = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    switch (args.length) {
      case 0:
        return "return";
      case 1:
        const argSrc = await transpileExpression(args[0], env);
        if (argSrc instanceof TranspileError) {
          return argSrc;
        }
        return `return ${argSrc}`;
      default:
        return new TranspileError(
          "`return` must receive at most one expression!",
        );
    }
  },
);

export const when = markAsDirectWriter(
  async (
    env: Env,
    bool: Form,
    ...rest: Block
  ): Promise<JsSrc | TranspileError> => {
    if (bool === undefined) {
      return new TranspileError("No expressions given to a `when` statement!");
    }
    if (rest.length < 1) {
      return new TranspileError("No statements given to a `when` statement!");
    }
    const boolSrc = await transpileExpression(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }
    const statementsSrc = await transpileBlock(rest, env);
    if (statementsSrc instanceof TranspileError) {
      return statementsSrc;
    }
    return `if(${boolSrc}){\n${statementsSrc}\n}`;
  },
);

export const incrementF = transpilingForVariableMutation("incrementF", "++");
export const decrementF = transpilingForVariableMutation("decrementF", "--");

export const plusF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} + ${b})`);
export const minusF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} - ${b})`);
export const timesF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} * ${b})`);
export const dividedByF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} / ${b})`);

export const equals = transpiling2((a: JsSrc, b: JsSrc) => `(${a} === ${b})`);
export const notEquals = transpiling2(
  (a: JsSrc, b: JsSrc) => `(${a} !== ${b})`,
);

export const isLessThan = transpiling2((a: JsSrc, b: JsSrc) => `(${a} < ${b})`);
export const isLessThanOrEquals = transpiling2(
  (a: JsSrc, b: JsSrc) => `(${a} <= ${b})`,
);
export const isGreaterThan = transpiling2(
  (a: JsSrc, b: JsSrc) => `(${a} > ${b})`,
);
export const isGreaterThanOrEquals = transpiling2(
  (a: JsSrc, b: JsSrc) => `(${a} >= ${b})`,
);

export const and = transpiling2((a: JsSrc, b: JsSrc) => `(${a} && ${b})`);
export const or = transpiling2((a: JsSrc, b: JsSrc) => `(${a} || ${b})`);
export const not = transpiling1("not", (a: JsSrc) => `!(${a})`);

export const assign = transpilingForAssignment(
  "assign",
  (env: Env, id: CuSymbol, exp: JsSrc) => {
    const w = EnvF.find(env, id.v);
    if (w !== undefined && isConst(w)) {
      return new TranspileError(
        `Variable "${id.v}" is NOT declared by \`let\`!`,
      );
    }
    return `${id.v} = ${exp}`;
  },
);

export const scope = buildScope("", "scope");

export const _cu$if = markAsDirectWriter(
  async (
    env: Env,
    bool: Form,
    ...rest: Form[]
  ): Promise<JsSrc | TranspileError> => {
    const boolSrc = await transpileExpression(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }

    const trueForms: Form[] = [];
    const falseForms: Form[] = [];
    let elseIsFound = false;
    for (const form of rest) {
      if (isCuSymbol(form) && EnvF.find(env, form.v) === _cu$else) {
        if (elseIsFound) {
          return new TranspileError(
            "`else` is specified more than once in an `if` expression!",
          );
        }
        elseIsFound = true;
        continue;
      }
      if (elseIsFound) {
        falseForms.push(form);
      } else {
        trueForms.push(form);
      }
    }
    if (trueForms.length < 1) {
      if (elseIsFound) {
        return new TranspileError("No expressions specified before `else`!");
      }
      return new TranspileError("No expressions given to an `if` expression!");
    }
    if (falseForms.length < 1) {
      if (elseIsFound) {
        return new TranspileError("No expressions specified after `else`!");
      }
      return new TranspileError("`else` not specified for an `if` expression!");
    }

    const ifTrueSrcs = await mapAE(
      trueForms,
      TranspileError,
      async (ifTrue) => await transpileExpression(ifTrue, env),
    );
    if (ifTrueSrcs instanceof TranspileError) {
      return ifTrueSrcs;
    }
    const ifTrueSrc =
      ifTrueSrcs.length > 1
        ? `(${ifTrueSrcs.join(", ")})`
        : assertNonNull(ifTrueSrcs[0], "Impossilbe");
    if (ifTrueSrc instanceof TranspileError) {
      return ifTrueSrc;
    }

    const ifFalseSrcs = await mapAE(
      falseForms,
      TranspileError,
      async (ifFalse) => await transpileExpression(ifFalse, env),
    );
    if (ifFalseSrcs instanceof TranspileError) {
      return ifFalseSrcs;
    }
    const ifFalseSrc = ifFalseSrcs.join(", ");

    return `(${boolSrc} ? ${ifTrueSrc} : ${ifFalseSrc})`;
  },
);

export const fn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildFn(env, "fn", args, block);
  },
);

export const procedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildProcedure(env, "procedure", args, block);
  },
);

export const array = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    const argsSrcs = await mapAE(
      args,
      TranspileError,
      async (arg) => await transpileExpression(arg, env),
    );
    if (argsSrcs instanceof TranspileError) {
      return argsSrcs;
    }
    return `[${argsSrcs.join(",")}]`;
  },
);

export const Map = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    if (args.length > 1) {
      return new TranspileError(`Too many arguments to \`Map\` (${JSON.stringify(args)})`);
    }
    if (args.length === 1) {
      const [arg] = args;
      const argSrc = await transpileExpression(arg, env);
      return `new Map(${argSrc})`;
    }
    return "new Map()";
  },
);
