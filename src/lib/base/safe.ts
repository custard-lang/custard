import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as EnvF from "../../internal/env.js";
import {
  aConst,
  aContextualKeyword,
  aVar,
  Block,
  CuSymbol,
  Env,
  Form,
  Id,
  isConst,
  isCuSymbol,
  JsSrc,
  LiteralObject,
  markAsDirectWriter,
  markAsDynamicVar,
  TranspileError,
} from "../../types.js";
import {
  transpileBlock,
  transpileExpression,
  transpileJoinWithComma,
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

export { standardModuleRoot } from "../../definitions.js";

export const note = markAsDirectWriter(
  (_env: Env, ..._args: Form[]): Promise<JsSrc> => Promise.resolve("void 0"),
);

export const annotate = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    return await transpileExpression(args[args.length - 1], env);
  },
);

export const _cu$const = transpilingForVariableDeclaration(
  "const",
  (assignee: JsSrc, exp: JsSrc) => `const ${assignee}=${exp}`,
  aConst,
);

export const _cu$let = transpilingForVariableDeclaration(
  "let",
  (assignee: JsSrc, exp: JsSrc) => `let ${assignee}=${exp}`,
  aVar,
);

export const _cu$return = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    switch (args.length) {
      case 0:
        return "return";
      case 1:
        const argSrc = await transpileExpression(args[0], env);
        if (TranspileError.is(argSrc)) {
          return argSrc;
        }
        return `return ${argSrc}`;
      default:
        return new TranspileError(
          "`return` must receive at most one expression!",
        );
    }
  },
  "statement",
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
    const boolSrc = await transpileExpression(bool, env);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }
    const statementsSrc = await transpileBlock(rest, env);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }
    return `if(${boolSrc}){\n${statementsSrc}\n}`;
  },
  "statement",
);

export const incrementF = transpilingForVariableMutation(
  "incrementF",
  (jsSrc) => `${jsSrc}+1`,
  (jsSrc) => `${jsSrc}++`,
);

export const decrementF = transpilingForVariableMutation(
  "decrementF",
  (jsSrc) => `${jsSrc}-1`,
  (jsSrc) => `${jsSrc}--`,
);

export const plusF = transpiling2("plusF", (a: JsSrc, b: JsSrc) => `${a}+${b}`);
export const minusF = transpiling2(
  "minusF",
  (a: JsSrc, b: JsSrc) => `(${a}-${b})`,
);
export const timesF = transpiling2(
  "timesF",
  (a: JsSrc, b: JsSrc) => `${a}*${b}`,
);
export const dividedByF = transpiling2(
  "dividedByF",
  (a: JsSrc, b: JsSrc) => `${a}/${b}`,
);

// TODO: If one of the argument is null, use == or !=
export const equals = transpiling2(
  "equals",
  (a: JsSrc, b: JsSrc) => `${a}===${b}`,
);
export const notEquals = transpiling2(
  "notEquals",
  (a: JsSrc, b: JsSrc) => `${a}!==${b}`,
);

export const isLessThan = transpiling2(
  "isLessThan",
  (a: JsSrc, b: JsSrc) => `${a}<${b}`,
);
export const isLessThanOrEquals = transpiling2(
  "isLessThanOrEquals",
  (a: JsSrc, b: JsSrc) => `${a}<=${b}`,
);
export const isGreaterThan = transpiling2(
  "isGreaterThan",
  (a: JsSrc, b: JsSrc) => `${a}>${b}`,
);
export const isGreaterThanOrEquals = transpiling2(
  "isGreaterThanOrEquals",
  (a: JsSrc, b: JsSrc) => `${a}>=${b}`,
);

export const isNone = transpiling1("isNone", (a: JsSrc) => `${a}==null`);

export const and = transpiling2("and", (a: JsSrc, b: JsSrc) => `${a}&&${b}`);
export const or = transpiling2("or", (a: JsSrc, b: JsSrc) => `${a}||${b}`);
export const not = transpiling1("not", (a: JsSrc) => `!(${a})`);

export const assign = transpilingForAssignment(
  "assign",
  async (
    env: Env,
    id: CuSymbol | LiteralObject,
    exp: JsSrc,
  ): Promise<JsSrc | TranspileError> => {
    function assignStatement(sym: CuSymbol, e: JsSrc): JsSrc | TranspileError {
      const r = EnvF.findWithIsAtTopLevel(env, sym.v);
      if (r === undefined || isConst(r.writer)) {
        return new TranspileError(
          `Variable "${sym.v}" is NOT declared by \`let\`!`,
        );
      }
      if (EnvF.writerIsAtReplTopLevel(env, r)) {
        return pseudoTopLevelAssignment(sym.v, e);
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
        if (TranspileError.is(assignment)) {
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
        if (TranspileError.is(kSrc)) {
          return kSrc;
        }
        assignment = assignStatement(v, `${tmpVar}${kSrc}`);
      }
      if (TranspileError.is(assignment)) {
        return assignment;
      }
      src = `${src}${assignment}\n`;
    }
    return src;
  },
  "expression",
);

export const scope = buildScope("scope", "");

export const _cu$if = markAsDirectWriter(
  async (
    env: Env,
    bool: Form,
    ...rest: Form[]
  ): Promise<JsSrc | TranspileError> => {
    const boolSrc = await transpileExpression(bool, env);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }

    // TODO: forms must be non-statements
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

    const ifTrueSrc = await transpileJoinWithComma(trueForms, env);
    if (TranspileError.is(ifTrueSrc)) {
      return ifTrueSrc;
    }

    const ifFalseSrc = await transpileJoinWithComma(falseForms, env);
    if (TranspileError.is(ifFalseSrc)) {
      return ifFalseSrc;
    }

    return `(${boolSrc}?(${ifTrueSrc}):(${ifFalseSrc}))`;
  },
);

export const _cu$else = aContextualKeyword("if");

// TODO: refactor with a feature to define syntax
export const _cu$try = markAsDirectWriter(
  async (env: Env, ...statements: Form[]): Promise<JsSrc | TranspileError> => {
    let trys: JsSrc = "";
    let catchs: JsSrc = "";
    let finallys: JsSrc = "";

    const initial = 0;
    const catchFound = 1;
    const finallyFound = 2;
    type State = typeof initial | typeof catchFound | typeof finallyFound;
    let state: State = initial;
    let catchVarName: Id | undefined = undefined;

    EnvF.pushInherited(env);
    for (const form of statements) {
      let isCatch = false;
      let isFinally = false;
      let transpiled: JsSrc | TranspileError;
      if (isCuSymbol(form)) {
        isCatch = EnvF.find(env, form.v) === _cu$catch;
        isFinally = EnvF.find(env, form.v) === _cu$finally;
      }
      switch (state) {
        case initial:
          if (isCatch) {
            EnvF.pop(env);
            state = catchFound;
            continue;
          }
          if (isFinally) {
            EnvF.pop(env);
            state = finallyFound;
            continue;
          }
          transpiled = await transpileExpression(form, env);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          trys = `${trys};\n${transpiled}`;
          break;
        case catchFound:
          if (isCatch) {
            return new TranspileError(
              "`catch` clause specified more than once",
            );
          }

          if (catchVarName === undefined) {
            if (isFinally) {
              return new TranspileError(
                "No variable name of the caught exception given to a `catch` clause!",
              );
            }
            if (isCuSymbol(form)) {
              EnvF.pushInherited(env);
              const r = EnvF.set(env, form.v, aConst());
              if (TranspileError.is(r)) {
                return r;
              }
              catchVarName = form.v;
              continue;
            }
            return new TranspileError(
              "No variable name of the caught exception given to a `catch` clause!",
            );
          }

          if (isFinally) {
            EnvF.pop(env);
            state = finallyFound;
            continue;
          }

          transpiled = await transpileExpression(form, env);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          catchs = `${catchs};\n${transpiled}`;
          break;
        case finallyFound:
          if (isCatch) {
            return new TranspileError(
              "A `finally` clause must be followed by a `catch` clause!",
            );
          }
          if (isFinally) {
            return new TranspileError(
              "`finally` clause specified more than once",
            );
          }

          if (finallys === "") {
            EnvF.pushInherited(env);
          }

          transpiled = await transpileExpression(form, env);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          finallys = `${finallys};\n${transpiled}`;
          break;
      }
    }

    EnvF.pop(env);

    if (state === initial) {
      return new TranspileError(
        "Nither `catch` nor `finally` given to a `try` statement!",
      );
    }

    let result = `try {${trys}}`;
    if (catchVarName !== undefined) {
      result = `${result}catch(${catchVarName}){${catchs}}`;
    } else if (state === catchFound) {
      return new TranspileError(
        "No variable name of the caught exception given to a `catch` clause!",
      );
    }

    if (state === finallyFound) {
      result = `${result}finally{${finallys}}`;
    }
    return result;
  },
  "statement",
);

export const _cu$catch = aContextualKeyword("try");

export const _cu$finally = aContextualKeyword("try");

export const _cu$throw = transpiling1(
  "throw",
  (a: JsSrc) => `throw ${a}`,
  "statement",
);

export const fn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildFn("fn", env, args, block);
  },
);

export const procedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsSrc | TranspileError> => {
    return await buildProcedure("procedure", env, args, block);
  },
);

export const text = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsSrc | TranspileError> => {
    const esc = (s: string): string => s.replace(/[$`\\]/g, "\\$&");

    let result = "`";
    for (const arg of args) {
      if (typeof arg === "string") {
        result = `${result}${esc(arg)}`;
        continue;
      }
      const r = await transpileExpression(arg, env);
      if (TranspileError.is(r)) {
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
      if (TranspileError.is(argSrc)) {
        return argSrc;
      }
      return `new Map(${argSrc})`;
    }
    return "new Map()";
  },
);

export const cu$thisFile = markAsDynamicVar(
  async ({
    transpileState: { srcPath },
  }: Env): Promise<JsSrc | TranspileError> => {
    const srcFullPath = path.resolve(srcPath);
    if ((await fs.stat(srcFullPath)).isDirectory()) {
      return new TranspileError(
        `${srcFullPath} is a directory! \`cu$thisFile\` is only allowed in a file`,
      );
    }
    return JSON.stringify(srcFullPath);
  },
);

export const cu$directoryOfThisFile = markAsDynamicVar(
  async ({
    transpileState: { srcPath },
  }: Env): Promise<JsSrc | TranspileError> => {
    const srcFullPath = path.resolve(srcPath);
    if ((await fs.stat(srcFullPath)).isDirectory()) {
      return JSON.stringify(srcFullPath);
    }
    return JSON.stringify(path.dirname(srcFullPath));
  },
);
