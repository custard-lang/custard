import * as MapU from "../../util/map.js";

import * as EnvF from "../../internal/env.js";
import { loadModulePath } from "../definitions.js";
import {
  aNamespace,
  CuArray,
  Env,
  Id,
  isConst,
  isCuSymbol,
  JsModule,
  markAsDirectWriter,
  TranspileError,
} from "../../internal/types.js";
import { pseudoTopLevelAssignment } from "../../internal/cu-env.js";
import {
  concatJsModules,
  emptyJsModule,
  extendBody,
  jsModuleOfBody,
  jsModuleOfImports,
} from "../../internal/transpile.js";

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

    const r1 = await loadModulePath(foundModule.url);
    if (r1 instanceof TranspileError) {
      return r1;
    }
    const ns = aNamespace();
    MapU.mergeFromTo(r1, ns.definitions);

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
          return pseudoTopLevelAssignment(id.v, awaitImport);
        case "module":
          const modulePathJson = JSON.stringify(foundModule.relativePath);
          return jsModuleOfImports(
            `import * as ${id.v} from ${modulePathJson}`,
          );
      }
    }
    return extendBody(awaitImport, `const ${id.v}=`);
  },
  "statement",
);

// TODO: refactor
// TODO: Set as prefixed const instead of importing all IDs at once
export const importAnyOf = markAsDirectWriter(
  async (env: Env, ...forms: CuArray): Promise<JsModule | TranspileError> => {
    if (forms.length !== 1) {
      return new TranspileError(
        "The number of arguments of `import` must be 1.",
      );
    }
    const [moduleId] = forms;
    if (!isCuSymbol(moduleId)) {
      return new TranspileError("The argument of `import` must be a Symbol.");
    }

    const foundModule = EnvF.findModule(env, moduleId.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${moduleId.v}\` registered in the Module Paths`,
      );
    }

    const r1 = await loadModulePath(foundModule.url);
    if (r1 instanceof TranspileError) {
      return r1;
    }

    MapU.mergeFromTo(r1, EnvF.getTopLevelScope(env).definitions);

    const ids: Id[] = [];
    for (const [id, w] of r1) {
      if (isConst(w)) {
        ids.push(id);
      }
    }

    const awaitImport = jsModuleOfBody(
      `await import(${JSON.stringify(foundModule.url)})`,
    );
    if (EnvF.isAtTopLevel(env)) {
      switch (env.transpileState.mode) {
        case "repl":
          let jsModule = emptyJsModule();
          for (const id of ids) {
            jsModule = concatJsModules(
              jsModule,
              pseudoTopLevelAssignment(id, awaitImport),
            );
          }
          return jsModule;
        case "module":
          const modulePathJson = JSON.stringify(foundModule.relativePath);
          return jsModuleOfImports(
            `import {${ids.join(", ")}} from ${modulePathJson}`,
          );
      }
    }
    return extendBody(awaitImport, `const {${ids.join(", ")}}=`);
  },
  "statement",
);
