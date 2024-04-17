import * as EnvF from "../env.js";
import { loadModule } from "../definitions.js";
import {
  canBePseudoTopLevelReferenced,
  CuSymbol,
  Env,
  exportableStatement,
  Form,
  Id,
  isCuSymbol,
  isWriter,
  JsSrc,
  markAsDirectWriter,
  ordinaryStatement,
  TranspileError,
} from "../types.js";
import { pseudoTopLevelAssignment } from "../cu-env.js";
import { transpileExpression } from "../transpile.js";

import { isExportableStatement } from "../../lib/base/common.js";

export const _cu$import = markAsDirectWriter(
  async (env: Env, ...forms: Form[]): Promise<JsSrc | TranspileError> => {
    const moduleId = validateArgsOfImport(forms, "import");
    if (TranspileError.is(moduleId)) {
      return moduleId;
    }

    const foundModule = await EnvF.findModule(env, moduleId.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${moduleId.v}\` registered in the Module Paths`,
      );
    }

    // TODO: Transpile if the module is a .cstd module
    const ns = await loadModule(foundModule.url);
    if (TranspileError.is(ns)) {
      return ns;
    }

    const r = EnvF.set(env, moduleId.v, ns);
    if (TranspileError.is(r)) {
      return r;
    }

    switch (env.transpileState.mode) {
      case "repl":
        const awaitImportUrl = `await import(${JSON.stringify(
          foundModule.url,
        )})`;
        return EnvF.isAtTopLevel(env)
          ? pseudoTopLevelAssignment(moduleId.v, awaitImportUrl)
          : `const ${moduleId.v}=${awaitImportUrl}`;
      case "module":
        const modulePathJson = JSON.stringify(foundModule.relativePath);
        if (EnvF.isAtTopLevel(env)) {
          return `import * as ${moduleId.v} from ${modulePathJson}`;
        }
        const awaitImportRelativePath = `await import(${modulePathJson})`;
        return `const ${moduleId.v}=${awaitImportRelativePath}`;
    }
  },
  ordinaryStatement,
);

export const importAnyOf = markAsDirectWriter(
  async (env: Env, ...forms: Form[]): Promise<JsSrc | TranspileError> => {
    const moduleId = validateArgsOfImport(forms, "importAnyOf");
    if (TranspileError.is(moduleId)) {
      return moduleId;
    }

    const foundModule = await EnvF.findModule(env, moduleId.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${moduleId.v}\` registered in the Module Paths`,
      );
    }
    // TODO: Transpile if the module is a .cstd module
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

    switch (env.transpileState.mode) {
      case "repl":
        const awaitImportUrl = `await import(${JSON.stringify(
          foundModule.url,
        )})`;
        if (EnvF.isAtTopLevel(env)) {
          let jsModule = "";
          for (const id of ids) {
            // TODO: Use tmp variable to avoid calling `import` multiple times
            const awaitImportDotId = `(${awaitImportUrl}).${id}`;
            jsModule = `${jsModule}${pseudoTopLevelAssignment(
              id,
              awaitImportDotId,
            )};\n`;
          }
          return jsModule;
        }
        return `const{${ids.join(", ")}}=${awaitImportUrl};\n`;
      case "module":
        const modulePathJson = JSON.stringify(foundModule.relativePath);
        if (EnvF.isAtTopLevel(env)) {
          return `import{${ids.join(", ")}}from${modulePathJson};\n`;
        }
        const awaitImportRelativePath = `await import(${modulePathJson})`;
        return `const{${ids.join(", ")}}=${awaitImportRelativePath};\n`;
    }
  },
  ordinaryStatement,
);

function validateArgsOfImport(
  forms: Form[],
  formId: Id,
): TranspileError | CuSymbol {
  if (forms.length !== 1) {
    return new TranspileError(
      `The number of arguments of \`${formId}\` must be 1.`,
    );
  }
  const [id] = forms;
  if (id === undefined || !isCuSymbol(id)) {
    return new TranspileError("The argument of `import` must be a Symbol.");
  }
  return id;
}

export const _cu$export = markAsDirectWriter(
  async (env: Env, ...forms: Form[]): Promise<JsSrc | TranspileError> => {
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
