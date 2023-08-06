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
  TranspileError,
  markAsDirectWriter,
  LiteralObject,
  JsModule,
} from "../../internal/types.js";
import {
  transpileExpression,
  transpileBlock,
  jsModuleOfBody,
  concatJsModules,
  extendBody,
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

export const _cu$const = transpilingForVariableDeclaration(
  "const",
  (assignee: JsModule, exp: JsModule) =>
    concatJsModules(
      jsModuleOfBody("const "),
      assignee,
      jsModuleOfBody("="),
      exp,
    ),
  aConst,
);

export const _cu$let = transpilingForVariableDeclaration(
  "let",
  (assignee: JsModule, exp: JsModule) =>
    concatJsModules(jsModuleOfBody("let "), assignee, jsModuleOfBody("="), exp),
  aVar,
);

export const _cu$else = aContextualKeyword("if");

export const _cu$return = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsModule | TranspileError> => {
    switch (args.length) {
      case 0:
        return jsModuleOfBody("return");
      case 1:
        const argSrc = await transpileExpression(args[0], env);
        if (argSrc instanceof TranspileError) {
          return argSrc;
        }
        return extendBody(argSrc, "return ");
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
  ): Promise<JsModule | TranspileError> => {
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
    return concatJsModules(
      jsModuleOfBody("if("),
      boolSrc,
      jsModuleOfBody("){\n"),
      statementsSrc,
      jsModuleOfBody("\n}"),
    );
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

export const plusF = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("+"),
    b,
    jsModuleOfBody(")"),
  ),
);
export const minusF = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("-"),
    b,
    jsModuleOfBody(")"),
  ),
);
export const timesF = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("*"),
    b,
    jsModuleOfBody(")"),
  ),
);
export const dividedByF = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("/"),
    b,
    jsModuleOfBody(")"),
  ),
);

// TODO: If one of the argument is null, use == or !=
export const equals = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("==="),
    b,
    jsModuleOfBody(")"),
  ),
);
export const notEquals = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("!=="),
    b,
    jsModuleOfBody(")"),
  ),
);

export const isLessThan = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("<"),
    b,
    jsModuleOfBody(")"),
  ),
);
export const isLessThanOrEquals = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("<="),
    b,
    jsModuleOfBody(")"),
  ),
);
export const isGreaterThan = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody(">"),
    b,
    jsModuleOfBody(")"),
  ),
);
export const isGreaterThanOrEquals = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody(">="),
    b,
    jsModuleOfBody(")"),
  ),
);

export const and = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("&&"),
    b,
    jsModuleOfBody(")"),
  ),
);
export const or = transpiling2((a: JsModule, b: JsModule) =>
  concatJsModules(
    jsModuleOfBody("("),
    a,
    jsModuleOfBody("||"),
    b,
    jsModuleOfBody(")"),
  ),
);
export const not = transpiling1("not", (a: JsModule) =>
  concatJsModules(jsModuleOfBody("!("), a, jsModuleOfBody(")")),
);

export const assign = transpilingForAssignment(
  "assign",
  async (env: Env, id: CuSymbol | LiteralObject, exp: JsModule) => {
    function assignStatement(
      sym: CuSymbol,
      e: JsModule,
    ): JsModule | TranspileError {
      const r = EnvF.findWithIsAtTopLevel(env, sym.v);
      if (r === undefined || isConst(r.writer)) {
        return new TranspileError(
          `Variable "${sym.v}" is NOT declared by \`let\`!`,
        );
      }
      if (EnvF.writerIsAtReplTopLevel(env, r)) {
        return pseudoTopLevelAssignment(sym.v, e);
      }
      return concatJsModules(jsModuleOfBody(`${sym.v}=`), e);
    }
    if (isCuSymbol(id)) {
      return assignStatement(id, exp);
    }
    const { id: tmpVar, statement } = EnvF.tmpVarOf(env, exp);
    let src = statement;
    for (const kvOrSym of id.v) {
      if (isCuSymbol(kvOrSym)) {
        const assignment = assignStatement(
          kvOrSym,
          jsModuleOfBody(`${tmpVar}.${kvOrSym.v}`),
        );
        if (assignment instanceof TranspileError) {
          return assignment;
        }
        src = concatJsModules(src, assignment, jsModuleOfBody("\n"));
        continue;
      }
      const [k, v] = kvOrSym;
      if (!isCuSymbol(v)) {
        return new TranspileError(
          `Assignee must be a symbol, but ${JSON.stringify(v)} is not!`,
        );
      }

      let assignment: JsModule | TranspileError;
      if (isCuSymbol(k)) {
        assignment = assignStatement(v, jsModuleOfBody(`${tmpVar}.${k.v}`));
      } else {
        const kSrc = await transpileExpression(k, env);
        if (kSrc instanceof TranspileError) {
          return kSrc;
        }
        assignment = assignStatement(v, extendBody(kSrc, tmpVar));
      }
      if (assignment instanceof TranspileError) {
        return assignment;
      }
      src = concatJsModules(src, assignment, jsModuleOfBody("\n"));
    }
    return src;
  },
  "expression",
);

export const scope = buildScope("", "scope");

export const _cu$if = markAsDirectWriter(
  async (
    env: Env,
    bool: Form,
    ...rest: Form[]
  ): Promise<JsModule | TranspileError> => {
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

    const ifTrueSrc = await transpileJoinWithComma(trueForms, env);
    if (ifTrueSrc instanceof TranspileError) {
      return ifTrueSrc;
    }

    const ifFalseSrc = await transpileJoinWithComma(falseForms, env);
    if (ifFalseSrc instanceof TranspileError) {
      return ifFalseSrc;
    }

    return concatJsModules(
      jsModuleOfBody("("),
      boolSrc,
      jsModuleOfBody("?("),
      ifTrueSrc,
      jsModuleOfBody("):"),
      jsModuleOfBody("("),
      ifFalseSrc,
      jsModuleOfBody(")"),
      jsModuleOfBody(")"),
    );
  },
);

export const fn = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsModule | TranspileError> => {
    return await buildFn(env, "fn", args, block);
  },
);

export const procedure = markAsDirectWriter(
  async (
    env: Env,
    args: Form,
    ...block: Form[]
  ): Promise<JsModule | TranspileError> => {
    return await buildProcedure(env, "procedure", args, block);
  },
);

export const array = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsModule | TranspileError> => {
    const argsSrc = await transpileJoinWithComma(args, env);
    if (argsSrc instanceof TranspileError) {
      return argsSrc;
    }
    return extendBody(argsSrc, "[", "]");
  },
);

export const text = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsModule | TranspileError> => {
    const esc = (s: string): string => s.replace(/[$`]/g, "\\$&");

    let result = jsModuleOfBody("`");
    for (const arg of args) {
      if (typeof arg === "string") {
        result = extendBody(result, "", esc(arg));
        continue;
      }
      const r = await transpileExpression(arg, env);
      if (r instanceof TranspileError) {
        return r;
      }
      result = concatJsModules(
        result,
        jsModuleOfBody("${"),
        r,
        jsModuleOfBody("}"),
      );
    }
    return extendBody(result, "", "`");
  },
);

export const Map = markAsDirectWriter(
  async (env: Env, ...args: Form[]): Promise<JsModule | TranspileError> => {
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
      return extendBody(argSrc, "new Map(", ")");
    }
    return jsModuleOfBody("new Map()");
  },
);
