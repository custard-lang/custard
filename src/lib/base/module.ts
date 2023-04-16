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

    if (env.transpileState.mode === "repl") {
      // TODO: マクロができたら (constAwait id  ...) でリファクタリング
      // TODO: Top levelかつreplでは _cu$env.topLevelValuesにset
      return `const ${id.v} = await import(${JSON.stringify(foundModule.url)})`;
    }
    return `import * as ${id.v} from ${JSON.stringify(
      foundModule.relativePath,
    )}`;
  },
);
