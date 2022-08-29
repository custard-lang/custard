// import { pr } from "../util/debug.js";
import { mapE } from "../util/error.js";

import {
  aContextualKeyword,
  aVar,
  Block,
  CuSymbol,
  Env,
  Form,
  isCuSymbol,
  JsSrc,
  Scope,
  TranspileError,
  Writer,
} from "../types.js";
import * as EnvF from "../env.js";
import {
  isCall,
  transpile,
  transpiling2,
  transpilingForAssignment,
} from "../transpile.js";

namespace Base {
  export const __const = transpilingForAssignment(
    (env: Env, id: CuSymbol, exp: JsSrc) => {
      const alreadyDefined = EnvF.atWhichScope(env, id.v) === 0;
      if (alreadyDefined) {
        return new TranspileError(
          `Variable ${JSON.stringify(id.v)} is already defined!`
        );
      }
      EnvF.set(env, id.v, aVar());
      return `const ${id.v} = ${exp}`;
    }
  );

  export const __let = transpilingForAssignment(
    (env: Env, id: CuSymbol, exp: JsSrc) => {
      const alreadyDefined = EnvF.atWhichScope(env, id.v) === 0;
      if (alreadyDefined) {
        return new TranspileError(
          `Variable ${JSON.stringify(id.v)} is already defined!`
        );
      }
      EnvF.set(env, id.v, aVar());
      return `let ${id.v} = ${exp}`;
    }
  );

  export const __else = aContextualKeyword();
}

function isNonExpressionCall(env: Env, form: Form): boolean {
  if (!isCall(form)) {
    return false;
  }
  const nonExpressions: (Writer | undefined)[] = [Base.__const, Base.__let];
  return nonExpressions.includes(EnvF.find(env, form[0].v));
}

export function base(): Scope {
  const b = new Map();

  b.set(
    "plusF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} + ${b})`)
  );
  b.set(
    "minusF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} - ${b})`)
  );
  b.set(
    "timesF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} * ${b})`)
  );
  b.set(
    "dividedByF",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} / ${b})`)
  );

  b.set(
    "equals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} === ${b})`)
  );
  b.set(
    "notEquals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} !== ${b})`)
  );

  b.set(
    "isLessThan",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} < ${b})`)
  );
  b.set(
    "isLessThanOrEquals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} <= ${b})`)
  );
  b.set(
    "isGreaterThan",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} > ${b})`)
  );
  b.set(
    "isGreaterThanOrEquals",
    transpiling2((a: JsSrc, b: JsSrc) => `(${a} >= ${b})`)
  );

  b.set("const", Base.__const);
  b.set("let", Base.__let);

  b.set(
    "assign",
    transpilingForAssignment((_env: Env, id: CuSymbol, exp: JsSrc) => {
      return `${id.v} = ${exp}`;
    })
  );

  b.set("scope", (env: Env, ...block: Block): JsSrc | TranspileError => {
    EnvF.push(env);
    let result = "(\n";

    const funcSrc = buildFunction(env, [], block);
    if (funcSrc instanceof TranspileError) {
      return funcSrc;
    }
    result = `${result}${funcSrc}`;
    result = `${result})()`;
    EnvF.pop(env);
    return result;
  });

  b.set("if", (env: Env, bool: Form, ...rest: Form[]):
    | JsSrc
    | TranspileError => {
    const boolSrc = transpile(bool, env);
    if (boolSrc instanceof TranspileError) {
      return boolSrc;
    }

    const trueForms: Form[] = [];
    const falseForms: Form[] = [];
    let elseIsFound = false;
    for (const form of rest) {
      if (isCuSymbol(form) && EnvF.find(env, form.v) === Base.__else) {
        if (elseIsFound) {
          return new TranspileError(
            "`else` is specified more than once in an `if` expression!"
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
      return new TranspileError("No expressions given to `if`!");
    }
    if (falseForms.length < 1) {
      if (elseIsFound) {
        return new TranspileError("No expressions specified after `else`!");
      }
      return new TranspileError("``else`` not specified for an `if`!");
    }

    const ifTrueSrcs = mapE(trueForms, TranspileError, (ifTrue) =>
      transpile(ifTrue, env)
    );
    if (ifTrueSrcs instanceof TranspileError) {
      return ifTrueSrcs;
    }
    const ifTrueSrc =
      ifTrueSrcs.length > 1 ? `(${ifTrueSrcs.join(", ")})` : ifTrueSrcs[0];

    const ifFalseSrcs = mapE(falseForms, TranspileError, (ifFalse) =>
      transpile(ifFalse, env)
    );
    if (ifFalseSrcs instanceof TranspileError) {
      return ifFalseSrcs;
    }
    const ifFalseSrc = ifFalseSrcs.join(", ");

    return `(${boolSrc} ? ${ifTrueSrc} : ${ifFalseSrc});`;
  });

  b.set("else", Base.__else);

  b.set("fn", (env: Env, args: Form, ...block: Form[]):
    | JsSrc
    | TranspileError => {
    return buildFunction(env, args, block);
  });

  return b;
}

function buildFunction(
  env: Env,
  args: Form,
  block: Block
): JsSrc | TranspileError {
  if (!(args instanceof Array)) {
    return new TranspileError(
      `Arguments for a function must be an array of symbols! But actually ${JSON.stringify(
        args
      )}`
    );
  }

  EnvF.push(env);

  const argNames = [];
  for (const arg of args) {
    if (!isCuSymbol(arg)) {
      return new TranspileError(
        `Arguments for a function must be an array of symbols! But actually ${JSON.stringify(
          args
        )}`
      );
    }
    EnvF.set(env, arg.v, aVar());
    argNames.push(arg.v);
  }

  let result = `(${argNames.join(", ")}) => {\n`;

  const lastI = block.length - 1;
  for (let i = 0; i < lastI; ++i) {
    const statement = block[i];
    const src = transpile(statement, env);
    if (src instanceof TranspileError) {
      return src;
    }
    result = `${result}  ${src};\n`;
  }
  const lastStatement = block[lastI];
  if (isNonExpressionCall(env, lastStatement)) {
    return new TranspileError(
      "The last statement in a `scope` must be an expression!"
    );
  }
  const lastSrc = transpile(lastStatement, env);
  if (lastSrc instanceof TranspileError) {
    return lastSrc;
  }
  result = `${result}  return ${lastSrc};\n`;
  result = `${result}}`;

  EnvF.pop(env);

  return result;
}
