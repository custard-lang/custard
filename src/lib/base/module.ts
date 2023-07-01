import * as EnvF from "../../internal/env.js";
import { loadModulePathInto, standardModuleRoot } from "../../definitions.js";
import {
  aNamespace,
  CuArray,
  Env,
  isCuSymbol,
  JsModule,
  markAsDirectWriter,
  TranspileError,
} from "../../internal/types.js";
import { pseudoTopLevelAssignment } from "../../internal/cu-env.js";
import {
  extendBody,
  jsModuleOfBody,
  jsModuleOfImports,
} from "../../internal/transpile.js";

export const standardRoot = standardModuleRoot;

export const _cu$import = markAsDirectWriter(
  async (env: Env, ...forms: CuArray): Promise<JsModule | TranspileError> => {
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

    const awaitImport = jsModuleOfBody(
      `await import(${JSON.stringify(foundModule.url)})`,
    );
    if (EnvF.isAtTopLevel(env)) {
      switch (env.transpileState.mode) {
        case "repl":
          return pseudoTopLevelAssignment(id, awaitImport);
        case "module":
          const modulePathJson = JSON.stringify(foundModule.relativePath);
          return jsModuleOfImports(
            `import * as ${id.v} from ${modulePathJson}`,
          );
      }
    }
    return extendBody(awaitImport, `const ${id.v}=`);
  },
);
