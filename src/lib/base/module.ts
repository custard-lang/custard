import { expectNever } from "../../util/error.js";

import * as EnvF from "../../internal/env.js";
import { loadModulePathInto } from "../../definitions.js";
import {
  aNamespace,
  CuArray,
  Env,
  isCuSymbol,
  JsSrc,
  markAsDirectWriter,
  TranspileError,
} from "../../internal/types.js";

export const _cu$import = markAsDirectWriter(
  async (env: Env, ...forms: CuArray): Promise<JsSrc | TranspileError> => {
    if (forms.length !== 1) {
      return new TranspileError(
        "The number of arguments of `import` must be 1.",
      );
    }
    const [id] = forms;
    if (!isCuSymbol(id)) {
      return new TranspileError("The argument of `import` must be a Symbol.");
    }

    const foundModule = EnvF.findModule(env, id.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${id.v}\` registered in the Module Paths`,
      );
    }
    if (foundModule instanceof TranspileError) {
      return foundModule;
    }

    const ns = aNamespace();
    const r1 = await loadModulePathInto(foundModule.url, ns.definitions);
    if (r1 instanceof TranspileError) {
      return r1;
    }

    const r2 = EnvF.set(env, id.v, ns);
    if (r2 instanceof TranspileError) {
      return r2;
    }

    if (EnvF.isAtTopLevel(env)) {
      switch (env.transpileState.mode) {
        case "repl":
          // TODO: マクロができたら (constAwait id  ...) でリファクタリング
          env.transpileState.awaitingId = id.v;
          const promiseId = `_cu$promise_${id.v}`;
          const promiseIdS = JSON.stringify(promiseId);
          const modulePathS = JSON.stringify(foundModule.url);
          return `void _cu$env.transpileState.topLevelValues.set(${promiseIdS}, import(${modulePathS}))`;
        case "module":
          return `import * as ${id.v} from ${JSON.stringify(
            foundModule.relativePath,
          )}`;
        default:
          return expectNever(env.transpileState) as string;
      }
    }
    return `const ${id.v} = await import(${JSON.stringify(foundModule)})`;
  },
);
