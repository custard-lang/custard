import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as ContextF from "../../internal/context.js";
import {
  transpileExpression,
  transpileJoinWithComma,
  transpileStatements,
} from "../../internal/transpile.js";
import {
  defaultScopeOptions,
  ktvalOther,
  ordinaryStatement,
} from "../../internal/types.js";
import {
  aConst,
  aContextualKeyword,
  type Block,
  type Context,
  type Form,
  type Id,
  isCuSymbol,
  type JsSrc,
  type Ktvals,
  markAsDirectWriter,
  markAsDynamicVar,
  TranspileError,
} from "../../types.js";

import {
  buildFn,
  buildProcedure,
  buildScope,
  transpiling1,
  transpiling1Unmarked,
  transpiling2,
  transpilingForVariableDeclaration,
  transpilingForVariableMutation,
  transpilingFunctionArguments,
} from "../internal.js";

export { standardModuleRoot } from "../../definitions.js";

export const note = markAsDirectWriter(
  async (_context: Context, ..._args: Form[]): Promise<Ktvals<JsSrc>> =>
    await Promise.resolve([ktvalOther("void 0")]),
);

export const annotate = markAsDirectWriter(
  async (
    context: Context,
    ...argsOrFirstForm: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const lastArg = argsOrFirstForm[argsOrFirstForm.length - 1];
    if (lastArg === undefined) {
      return [];
    }
    return await transpileExpression(lastArg, context);
  },
);

export const _cu$const = transpilingForVariableDeclaration(
  "const ",
  (assignee: JsSrc, exp?: Ktvals<JsSrc>): Ktvals<JsSrc> | TranspileError =>
    exp === undefined
      ? new TranspileError("No variable name given to a `const`!")
      : [ktvalOther(`const ${assignee}`), ktvalOther("="), ...exp],
  aConst,
);

export const _cu$return = markAsDirectWriter(
  async (
    context: Context,
    ...argsOrFirstForm: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (argsOrFirstForm.length > 1) {
      return new TranspileError(
        "`return` must receive at most one expression!",
      );
    }
    const arg = argsOrFirstForm[0];
    if (arg === undefined) {
      return [ktvalOther("return")];
    }
    const argSrc = await transpileExpression(arg, context);
    if (TranspileError.is(argSrc)) {
      return argSrc;
    }
    return [ktvalOther("return "), ...argSrc];
  },
  ordinaryStatement,
);

export const when = markAsDirectWriter(
  async (
    context: Context,
    bool?: Form,
    ...rest: Block
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (bool === undefined) {
      return new TranspileError("No expressions given to a `when` statement!");
    }
    const boolSrc = await transpileExpression(bool, context);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }
    const statementsSrc = await transpileStatements(rest, context);
    if (TranspileError.is(statementsSrc)) {
      return statementsSrc;
    }
    return [
      ktvalOther("if("),
      ...boolSrc,
      ktvalOther("){\n"),
      ...statementsSrc,
      ktvalOther("\n}"),
    ];
  },
  ordinaryStatement,
);

export const incrementF = transpilingForVariableMutation(
  "incrementF",
  (jsSrc) => [jsSrc, ktvalOther(`+1`)],
  (jsSrc) => [ktvalOther(`${jsSrc}++`)],
);

export const decrementF = transpilingForVariableMutation(
  "decrementF",
  (jsSrc) => [jsSrc, ktvalOther(`-1`)],
  (jsSrc) => [ktvalOther(`${jsSrc}--`)],
);

export const plusF = transpiling2(
  "plusF",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("+"), ...b],
);
export const minusF = transpiling2(
  "minusF",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("-"), ...b],
);
export const timesF = transpiling2(
  "timesF",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("*"), ...b],
);
export const dividedByF = transpiling2(
  "dividedByF",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("/"), ...b],
);

// TODO: If one of the argument is null, use == or !=
export const equals = transpiling2(
  "equals",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("==="), ...b],
);
export const notEquals = transpiling2(
  "notEquals",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("!=="), ...b],
);

export const isLessThan = transpiling2(
  "isLessThan",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("<"), ...b],
);
export const isLessThanOrEquals = transpiling2(
  "isLessThanOrEquals",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther("<="), ...b],
);
export const isGreaterThan = transpiling2(
  "isGreaterThan",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther(">"), ...b],
);
export const isGreaterThanOrEquals = transpiling2(
  "isGreaterThanOrEquals",
  (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [...a, ktvalOther(">="), ...b],
);

export const isNone = transpiling1("isNone", (a: Ktvals<JsSrc>) => [
  ...a,
  ktvalOther("==null"),
]);
export const isString = transpiling1("isString", (a: Ktvals<JsSrc>) => [
  ktvalOther("typeof "),
  ...a,
  ktvalOther('=="string"'),
]);

export const and = transpiling2("and", (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [
  ...a,
  ktvalOther("&&"),
  ...b,
]);
export const or = transpiling2("or", (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [
  ...a,
  ktvalOther("||"),
  ...b,
]);
export const not = transpiling1("not", (a: Ktvals<JsSrc>) => [
  ktvalOther("!("),
  ...a,
  ktvalOther(")"),
]);

export const any = transpiling2("any", (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [
  ...a,
  ktvalOther("??"),
  ...b,
]);

export const scope = buildScope("scope", "function", defaultScopeOptions);

export const _cu$if = markAsDirectWriter(
  async (
    context: Context,
    bool?: Form,
    ...rest: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (bool === undefined) {
      return new TranspileError("No expressions given to an `if` expression!");
    }

    const boolSrc = await transpileExpression(bool, context);
    if (TranspileError.is(boolSrc)) {
      return boolSrc;
    }

    const trueForms: Form[] = [];
    const falseForms: Form[] = [];
    let elseIsFound = false;
    for (const form of rest) {
      if (isCuSymbol(form) && ContextF.find(context, form) === _cu$else) {
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

    const ifTrueSrc = await transpileJoinWithComma(trueForms, context);
    if (TranspileError.is(ifTrueSrc)) {
      return ifTrueSrc;
    }

    const ifFalseSrc = await transpileJoinWithComma(falseForms, context);
    if (TranspileError.is(ifFalseSrc)) {
      return ifFalseSrc;
    }

    return [
      ktvalOther("("),
      ...boolSrc,
      ktvalOther(")?("),
      ...ifTrueSrc,
      ktvalOther("):("),
      ...ifFalseSrc,
      ktvalOther(")"),
    ];
  },
);

export const _cu$else = aContextualKeyword("if");

// TODO: refactor with a feature to define syntax
export const _cu$try = markAsDirectWriter(
  async (
    context: Context,
    ...statements: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const trys: Ktvals<JsSrc> = [];
    const catchs: Ktvals<JsSrc> = [];
    const finallys: Ktvals<JsSrc> = [];

    const initial = 0;
    const catchFound = 1;
    const finallyFound = 2;
    type State = typeof initial | typeof catchFound | typeof finallyFound;
    let state: State = initial;
    let catchVarName: Id | undefined;

    ContextF.pushInherited(context);
    for (const form of statements) {
      let isCatch = false;
      let isFinally = false;
      let transpiled: Ktvals<JsSrc> | TranspileError;
      if (isCuSymbol(form)) {
        isCatch = ContextF.find(context, form) === _cu$catch;
        isFinally = ContextF.find(context, form) === _cu$finally;
      }
      switch (state) {
        case initial:
          if (isCatch) {
            ContextF.pop(context);
            state = catchFound;
            continue;
          }
          if (isFinally) {
            ContextF.pop(context);
            state = finallyFound;
            continue;
          }
          transpiled = await transpileExpression(form, context);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          trys.push(ktvalOther(";\n"), ...transpiled);
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
              ContextF.pushInherited(context);
              const r = ContextF.set(context, form.value, aConst());
              if (TranspileError.is(r)) {
                return r;
              }
              catchVarName = form.value;
              continue;
            }
            return new TranspileError(
              "No variable name of the caught exception given to a `catch` clause!",
            );
          }

          if (isFinally) {
            ContextF.pop(context);
            state = finallyFound;
            continue;
          }

          transpiled = await transpileExpression(form, context);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          catchs.push(ktvalOther(";\n"), ...transpiled);
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

          if (finallys.length === 0) {
            ContextF.pushInherited(context);
          }

          transpiled = await transpileExpression(form, context);
          if (TranspileError.is(transpiled)) {
            return transpiled;
          }
          finallys.push(ktvalOther(";\n"), ...transpiled);
          break;
      }
    }

    ContextF.pop(context);

    if (state === initial) {
      return new TranspileError(
        "Nither `catch` nor `finally` given to a `try` statement!",
      );
    }

    const result = [ktvalOther("try {"), ...trys, ktvalOther("}")];
    if (catchVarName !== undefined) {
      result.push(
        ktvalOther(`catch(${catchVarName}){`),
        ...catchs,
        ktvalOther("}"),
      );
    } else if (state === catchFound) {
      return new TranspileError(
        "No variable name of the caught exception given to a `catch` clause!",
      );
    }

    if (state === finallyFound) {
      result.push(ktvalOther("finally{"), ...finallys, ktvalOther("}"));
    }
    return result;
  },
  ordinaryStatement,
);

export const _cu$catch = aContextualKeyword("try");

export const _cu$finally = aContextualKeyword("try");

export const _cu$throw = transpiling1(
  "throw",
  (a: Ktvals<JsSrc>) => [ktvalOther("throw "), ...a],
  ordinaryStatement,
);

export const fn = markAsDirectWriter(
  async (
    context: Context,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildFn(
      "fn",
      context,
      nameOrArgs,
      argsOrFirstForm,
      block,
      defaultScopeOptions,
      "function",
    );
  },
);

export const procedure = markAsDirectWriter(
  async (
    context: Context,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildProcedure(
      "procedure",
      context,
      nameOrArgs,
      argsOrFirstForm,
      block,
      defaultScopeOptions,
      "function",
    );
  },
);

export const generatorFn = markAsDirectWriter(
  async (
    context: Context,
    nameOrArgs?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildFn(
      "generatorFn",
      context,
      nameOrArgs,
      argsOrFirstForm,
      block,
      { isAsync: false, isGenerator: true },
      "function*",
    );
  },
);

export const generatorProcedure = markAsDirectWriter(
  async (
    context: Context,
    name?: Form,
    argsOrFirstForm?: Form,
    ...block: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    return await buildProcedure(
      "generatorProcedure",
      context,
      name,
      argsOrFirstForm,
      block,
      { isAsync: false, isGenerator: true },
      "function*",
    );
  },
);

export const _cu$yield = markAsDirectWriter(
  async (
    context: Context,
    a?: Form,
    ...unused: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (a === undefined) {
      return new TranspileError("`yield` must be followed by an expression!");
    }

    if (!ContextF.isInGeneratorContext(context)) {
      return new TranspileError(
        "`yield` must be used in a generator function!",
      );
    }
    return await transpiling1Unmarked("yield", (s: Ktvals<JsSrc>) => [
      ktvalOther("yield "),
      ...s,
    ])(context, a, ...unused);
  },
  ordinaryStatement,
);

export const text = markAsDirectWriter(
  async (
    context: Context,
    ...argsOrFirstForm: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const esc = (s: string): string => s.replace(/[$`\\]/g, "\\$&");

    const result: Ktvals<JsSrc> = [ktvalOther("`")];
    for (const arg of argsOrFirstForm) {
      if (typeof arg === "string") {
        result.push(ktvalOther(esc(arg)));
        continue;
      }
      const r = await transpileExpression(arg, context);
      if (TranspileError.is(r)) {
        return r;
      }
      result.push(ktvalOther("${"), ...r, ktvalOther("}"));
    }
    return [...result, ktvalOther(`\``)];
  },
);

export const cu$thisFile = markAsDynamicVar(
  async ({
    transpileState: { src: srcPath },
  }: Context): Promise<Ktvals<JsSrc> | TranspileError> => {
    const srcFullPath = path.resolve(srcPath.path);
    if ((await fs.stat(srcFullPath)).isDirectory()) {
      return new TranspileError(
        `${srcFullPath} is a directory! \`cu$thisFile\` is only allowed in a file`,
      );
    }
    return [ktvalOther(JSON.stringify(srcFullPath))];
  },
);

export const cu$directoryOfThisFile = markAsDynamicVar(
  async ({
    transpileState: { src: srcPath },
  }: Context): Promise<Ktvals<JsSrc> | TranspileError> => {
    const srcFullPath = path.resolve(srcPath.path);
    if ((await fs.stat(srcFullPath)).isDirectory()) {
      return [ktvalOther(JSON.stringify(srcFullPath))];
    }
    return [ktvalOther(JSON.stringify(path.dirname(srcFullPath)))];
  },
);

export const get = transpiling2("get", (a: Ktvals<JsSrc>, b: Ktvals<JsSrc>) => [
  ...a,
  ktvalOther("["),
  ...b,
  ktvalOther("]"),
]);

export const first = transpiling1("first", (a: Ktvals<JsSrc>) => [
  ...a,
  ktvalOther("[0]"),
]);

// TODO: If a.at(-1) is not faster, implement a[a.length] as macro after
//       implementing more flexible tmpVar generator.
export const last = transpiling1("last", (a: Ktvals<JsSrc>) => [
  ...a,
  ktvalOther(".at(-1)"),
]);

export const createMap = transpilingFunctionArguments(
  (argSrcs: Ktvals<JsSrc>): Ktvals<JsSrc> => [
    ktvalOther("new Map("),
    ...argSrcs,
    ktvalOther(")"),
  ],
);

export const createRegExp = transpilingFunctionArguments(
  (argSrcs: Ktvals<JsSrc>): Ktvals<JsSrc> => [
    ktvalOther("new RegExp("),
    ...argSrcs,
    ktvalOther(")"),
  ],
);
