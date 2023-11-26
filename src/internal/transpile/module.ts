import * as EnvF from "../env.js";
import { loadModule } from "../definitions.js";
import {
  canBePseudoTopLevelReferenced,
  CuArray,
  Env,
  exportableStatement,
  Id,
  isCuSymbol,
  isWriter,
  JsSrc,
  markAsDirectWriter,
  ordinaryStatement,
  TranspileError,
} from "../../internal/types.js";
import { pseudoTopLevelAssignment } from "../cu-env.js";
import { transpileExpression } from "../transpile.js";

import { isExportableStatement } from "../../lib/base/common.js";

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
  ordinaryStatement,
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
    EnvF.mergeNamespaceIntoCurrentScope(env, ns);

    const ids: Id[] = [];
    for (const [id, w] of Object.entries(ns)) {
      if (!isWriter(w) || canBePseudoTopLevelReferenced(w)) {
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
  ordinaryStatement,
);

export const _cu$export = markAsDirectWriter(
  async (env: Env, ...forms: CuArray): Promise<JsSrc | TranspileError> => {
    if (forms.length === 0) {
      return new TranspileError(
        "The number of arguments of `export` must be at least 1.",
      );
    }

    if (!EnvF.isAtTopLevel(env)) {
      return new TranspileError("`export` must be used at the top level.");
    }

    let result = "";
    for (const form of forms) {
      if (!isExportableStatement(env, form)) {
        return new TranspileError(
          "The arguments of `export` must be a const/let declaration.",
        );
      }
      const r = await transpileExpression(form, env);
      if (TranspileError.is(r)) {
        return r;
      }

      if (env.transpileState.mode === "module") {
        result = `${result}export ${r};\n`;
      } else {
        result = `${result}${r};\n`;
      }
    }
    return result;
  },
  exportableStatement,
);
