import * as EnvF from "../../internal/env.js";
import { Env } from "../../internal/types.js";

import {
  CuArray,
  isCuSymbol,
  JsSrc,
  Scope,
  TranspileError,
} from "../../types.js";
import { expectNever } from "../../util/error.js";

export function module(): Scope {
  const b: Scope = new Map();

  b.set("import", (env: Env, ...forms: CuArray): JsSrc | TranspileError => {
    if (forms.length !== 1) {
      return new TranspileError("The arguments of `import` must be 1.");
    }
    const [id] = forms;
    if (!isCuSymbol(id)) {
      return new TranspileError("The argument of `import` must be a Symbol.");
    }

    const modulePath = EnvF.findModule(env, id.v);
    if (modulePath === undefined) {
      return new TranspileError(
        `No module \`${id.v}\` registered in the Module Paths`,
      );
    }
    if (modulePath instanceof TranspileError) {
      return modulePath;
    }

    if (EnvF.isAtTopLevel(env)) {
      switch (env.transpileState.mode) {
        case "repl":
          // TODO: マクロができたら (constAwait id  ...) でリファクタリング
          env.transpileState.awaitingId = id.v;
          const promiseId = `__cu$promise_${id.v}`;
          const promiseIdS = JSON.stringify(promiseId);
          const modulePathS = JSON.stringify(modulePath);
          return `void __cu$Context.set(${promiseIdS}, import(${modulePathS}))`;
        case "module":
          return `import * as ${id.v} from ${JSON.stringify(modulePath)}`;
        default:
          return expectNever(env.transpileState) as string;
      }
    }
    return `const ${id.v} = await import(${JSON.stringify(modulePath)})`;
  });

  return b;
}
