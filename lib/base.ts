import {
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
      EnvF.set(env, id.v, "Var");
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
      EnvF.set(env, id.v, "Var");
      return `let ${id.v} = ${exp}`;
    }
  );
}

function isNonExpressionCall(env: Env, form: Form): boolean {
  if (!(form instanceof Array)) {
    return false;
  }
  if (!isCuSymbol(form[0])) {
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
    let result = "(() => {\n";

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
    result += "})()";
    EnvF.pop(env);
    return result;
  });

  return b;
}
