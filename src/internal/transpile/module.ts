import * as MapU from "../../util/map.js";

import * as EnvF from "../../internal/env.js";
import { loadModule } from "../definitions.js";
import {
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

    const foundModule = await EnvF.findModule(env, id.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${id.v}\` registered in the Module Paths`,
      );
    }

    const ns = await loadModule(foundModule.url);
    if (TranspileError.is(ns)) {
      return ns;
    }

    const r = EnvF.set(env, id.v, ns);
    if (TranspileError.is(r)) {
      return r;
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
      return new TranspileError(
        "The argument of `importAnyOf` must be a Symbol.",
      );
    }

    const foundModule = await EnvF.findModule(env, moduleId.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${moduleId.v}\` registered in the Module Paths`,
      );
    }

    const ns = await loadModule(foundModule.url);
    if (TranspileError.is(ns)) {
      return ns;
    }
    MapU.mergeFromTo(ns.definitions, EnvF.getCurrentScope(env).definitions);

    const ids: Id[] = [];
    for (const [id, w] of ns.definitions) {
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
            )};\n`;
          }
          return jsModule;
        case "module":
          const modulePathJson = JSON.stringify(foundModule.relativePath);
          return `import{${ids.join(", ")}}from${modulePathJson};\n`;
      }
    }
    return `const{${ids.join(", ")}}=${awaitImport};\n`;
  },
  "statement",
);
