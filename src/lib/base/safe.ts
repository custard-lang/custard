import { mapJoinWithCommaAE } from "../../util/error.js";

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
  KeyValues,
} from "../../internal/types.js";
import {
  transpileExpression,
  transpileBlock,
} from "../../internal/transpile.js";
import { pseudoTopLevelAssignment } from "../../internal/cu-env.js";

import {
  buildFn,
  buildProcedure,
  buildScope,
  transpiling1,
  transpiling2,
  transpilingForAssignment,
  transpilingForVariableDeclaration,
  transpilingForVariableMutation,
} from "./common.js";

export const _cu$const = transpilingForVariableDeclaration(
  "const",
  (assignee: JsSrc, exp: JsSrc) => `const ${assignee} = ${exp}`,
  aConst,
);

export const _cu$let = transpilingForVariableDeclaration(
  "let",
  (assignee: JsSrc, exp: JsSrc) => `let ${assignee} = ${exp}`,
  aVar,
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

export const incrementF = transpilingForVariableMutation(
  "incrementF",
  (jsExp) => `${jsExp}+1`,
  (jsExp) => `${jsExp}++`,
);

export const decrementF = transpilingForVariableMutation(
  "decrementF",
  (jsExp) => `${jsExp}-1`,
  (jsExp) => `${jsExp}--`,
);

export const plusF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} + ${b})`);
export const minusF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} - ${b})`);
export const timesF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} * ${b})`);
export const dividedByF = transpiling2((a: JsSrc, b: JsSrc) => `(${a} / ${b})`);

export const equals = transpiling2((a: JsSrc, b: JsSrc) => `(${a} === ${b})`);
export const notEquals = transpiling2((a: JsSrc, b: JsSrc) => `(${a}!==${b})`);

export const isLessThan = transpiling2((a: JsSrc, b: JsSrc) => `(${a} < ${b})`);
export const isLessThanOrEquals = transpiling2(
  (a: JsSrc, b: JsSrc) => `(${a}<=${b})`,
);
export const isGreaterThan = transpiling2(
  (a: JsSrc, b: JsSrc) => `(${a}>${b})`,
);
export const isGreaterThanOrEquals = transpiling2(
  (a: JsSrc, b: JsSrc) => `(${a}>=${b})`,
);

export const and = transpiling2((a: JsSrc, b: JsSrc) => `(${a}&&${b})`);
export const or = transpiling2((a: JsSrc, b: JsSrc) => `(${a}||${b})`);
export const not = transpiling1("not", (a: JsSrc) => `!(${a})`);

export const assign = transpilingForAssignment(
  "assign",
  async (env: Env, id: CuSymbol | KeyValues, exp: JsSrc) => {
    function assignStatement(sym: CuSymbol, e: JsSrc): JsSrc | TranspileError {
      const r = EnvF.findWithIsAtTopLevel(env, sym.v);
      if (r === undefined || isConst(r.writer)) {
        return new TranspileError(
          `Variable "${sym.v}" is NOT declared by \`let\`!`,
        );
      }
      if (EnvF.writerIsAtReplTopLevel(env, r)) {
        return pseudoTopLevelAssignment(sym, e);
      }
      return `${sym.v}=${e}`;
    }
    if (isCuSymbol(id)) {
      return assignStatement(id, exp);
    }
    const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
    let src = statement;
    for (const kvOrSym of id.v) {
      if (isCuSymbol(kvOrSym)) {
        const assignment = assignStatement(kvOrSym, `${tmpVar}.${kvOrSym.v}`);
        if (assignment instanceof TranspileError) {
          return assignment;
        }
        src = `${src}${assignment}\n`;
        continue;
      }
      const [k, v] = kvOrSym;
      if (!isCuSymbol(v)) {
        return new TranspileError(
          `Assignee must be a symbol, but ${JSON.stringify(v)} is not!`,
        );
      }

      let assignment: JsSrc | TranspileError;
      if (isCuSymbol(k)) {
        assignment = assignStatement(v, `${tmpVar}.${k.v}`);
      } else {
        const kSrc = await transpileExpression(k, env);
        if (kSrc instanceof TranspileError) {
          return kSrc;
        }
        assignment = assignStatement(v, `${tmpVar}${kSrc}`);
      }
      if (assignment instanceof TranspileError) {
        return assignment;
      }
      src = `${src}${assignment}\n`;
    }
    return src;
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

    const ifTrueSrc = await mapJoinWithCommaAE(
      trueForms,
      TranspileError,
      async (ifTrue) => await transpileExpression(ifTrue, env),
    );
    if (ifTrueSrc instanceof TranspileError) {
      return ifTrueSrc;
    }

    const ifFalseSrc = await mapJoinWithCommaAE(
      falseForms,
      TranspileError,
      async (ifFalse) => await transpileExpression(ifFalse, env),
    );
    if (ifFalseSrc instanceof TranspileError) {
      return ifFalseSrc;
    }

    return `(${boolSrc} ? (${ifTrueSrc}) : ${ifFalseSrc})`;
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
    const argsSrc = await mapJoinWithCommaAE(
      args,
      TranspileError,
      async (arg) => await transpileExpression(arg, env),
    );
    if (argsSrc instanceof TranspileError) {
      return argsSrc;
    }
    return `[${argsSrc}]`;
  },
);

export const text = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    const esc = (s: string): string => s.replace(/[$`]/g, "\\$&");

    let result = "`";
    for (const arg of args) {
      if (typeof arg === "string") {
        result = `${result}${esc(arg)}`;
        continue;
      }
      const r = await transpileExpression(arg, env);
      if (r instanceof TranspileError) {
        return r;
      }
      result = `${result}\${${r}}`;
    }
    return `${result}\``;
  },
);

export const Map = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    if (args.length > 1) {
      return new TranspileError(
        `Too many arguments to \`Map\` (${JSON.stringify(args)})`,
      );
    }
    if (args.length === 1) {
      const [arg] = args;
      const argSrc = await transpileExpression(arg, env);
      if (argSrc instanceof TranspileError) {
        return argSrc;
      }
      return `new Map(${argSrc})`;
    }
    return "new Map()";
  },
);
