import * as MapU from "../../util/map.js";

import * as EnvF from "../../internal/env.js";
import { loadModulePath } from "../definitions.js";
import {
  aNamespace,
  canBePseudoTopLevelReferenced,
  CuArray,
  Env,
  Id,
  isCuSymbol,
  JsSrc,
  markAsDirectWriter,
  TranspileError,
} from "../../internal/types.js";
import { pseudoTopLevelAssignment } from "../../internal/cu-env.js";

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

    const r1 = await loadModulePath(foundModule.url);
    if (TranspileError.is(r1)) {
      return r1;
    }
    const ns = aNamespace();
    MapU.mergeFromTo(r1, ns.definitions);

    const r2 = EnvF.set(env, id.v, ns);
    if (TranspileError.is(r2)) {
      return r2;
    }

    const awaitImport = `await import(${JSON.stringify(foundModule.url)})`;
    if (EnvF.isAtTopLevel(env)) {
      switch (env.transpileState.mode) {
        case "repl":
          return pseudoTopLevelAssignment(id.v, awaitImport);
        case "module":
          const modulePathJson = JSON.stringify(foundModule.relativePath);
          return `import * as ${id.v} from ${modulePathJson}`;
      }
    }
    return `${`const ${id.v}=`}${awaitImport}`;
  },
  "statement",
);

// TODO: refactor
export const importAnyOf = markAsDirectWriter(
  async (env: Env, ...forms: CuArray): Promise<JsSrc | TranspileError> => {
    if (forms.length !== 1) {
      return new TranspileError(
        "The number of arguments of `importAnyOf` must be 1.",
      );
    }
    const [moduleId] = forms;
    if (!isCuSymbol(moduleId)) {
      return new TranspileError("The argument of `importAnyOf` must be a Symbol.");
    }

    const foundModule = EnvF.findModule(env, moduleId.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${moduleId.v}\` registered in the Module Paths`,
      );
    }

    const r1 = await loadModulePath(foundModule.url);
    if (TranspileError.is(r1)) {
      return r1;
    }

    MapU.mergeFromTo(r1, EnvF.getCurrentScope(env).definitions);

    const ids: Id[] = [];
    for (const [id, w] of r1) {
      if (canBePseudoTopLevelReferenced(w)) {
        ids.push(id);
      }
    }

    const awaitImport = `await import(${JSON.stringify(foundModule.url)})`;
    if (EnvF.isAtTopLevel(env)) {
      switch (env.transpileState.mode) {
        case "repl":
          let jsModule = "";
          for (const id of ids) {
            // TODO: Use tmp variable to avoid calling `import` multiple times
            const awaitImportDotId = `(${awaitImport}).${id}`;
            jsModule = `${jsModule}${pseudoTopLevelAssignment(
              id,
              awaitImportDotId,
            )}`;
          }
          return jsModule;
        case "module":
          const modulePathJson = JSON.stringify(foundModule.relativePath);
          return `import {${ids.join(", ")}} from ${modulePathJson}`;
      }
    }
    return `const {${ids.join(", ")}}=${awaitImport}`;
  },
  "statement",
);
