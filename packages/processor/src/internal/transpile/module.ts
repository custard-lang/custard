import * as EnvF from "../env.js";
import { loadModule } from "../definitions.js";
import {
  type CuSymbol,
  type Env,
  type Form,
  type Id,
  isCuSymbol,
  type JsSrc,
  markAsDirectWriter,
  TranspileError,
} from "../../types.js";
import {
  canBePseudoTopLevelReferenced,
  ordinaryStatement,
  isWriter,
  exportableStatement,
  type Ktvals,
  ktvalImport,
  ktvalOther,
  ktvalImportStartAs,
  ktvalExport,
} from "../types.js";
import { transpileExpression } from "../transpile.js";

import { isExportableStatement } from "../call.js";

export const _cu$import = markAsDirectWriter(
  async (
    env: Env,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const moduleId = validateArgsOfImport(forms, "import");
    if (TranspileError.is(moduleId)) {
      return moduleId;
    }

    const foundModule = await EnvF.findModule(env, moduleId.value);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${moduleId.value}\` registered in the Module Paths`,
      );
    }

    // TODO: Transpile if the module is a .cstd module
    const ns = await loadModule(foundModule.u);
    if (TranspileError.is(ns)) {
      return ns;
    }

    const r = EnvF.set(env, moduleId.value, ns);
    if (TranspileError.is(r)) {
      return r;
    }

    const isTopLevel = EnvF.isAtTopLevel(env);
    EnvF.setImportedModulesJsId(env, foundModule, {
      id: moduleId.value,
      isTopLevel,
    });

    if (isTopLevel) {
      return [ktvalImportStartAs(foundModule.u, foundModule.r, moduleId.value)];
    }

    let specifier: string;
    switch (env.transpileState.mode) {
      case "repl": {
        specifier = foundModule.u;
        break;
      }
      case "module": {
        specifier = foundModule.r;
        break;
      }
    }
    return [
      ktvalOther(
        `const ${moduleId.value}=await import(${JSON.stringify(specifier)})`,
      ),
    ];
  },
  ordinaryStatement,
);

export const importAnyOf = markAsDirectWriter(
  async (
    env: Env,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const moduleId = validateArgsOfImport(forms, "importAnyOf");
    if (TranspileError.is(moduleId)) {
      return moduleId;
    }

    const foundModule = await EnvF.findModule(env, moduleId.value);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${moduleId.value}\` registered in the Module Paths`,
      );
    }
    // TODO: Transpile if the module is a .cstd module
    const ns = await loadModule(foundModule.u);
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

    const isTopLevel = EnvF.isAtTopLevel(env);
    for (const id of ids) {
      EnvF.setImportedModulesJsId(env, foundModule, {
        id,
        isTopLevel,
      });
    }

    if (isTopLevel) {
      return [ktvalImport(foundModule.u, foundModule.r, ids)];
    }

    let specifierForNonTopLevel: string;
    switch (env.transpileState.mode) {
      case "repl": {
        specifierForNonTopLevel = foundModule.u;
        break;
      }
      case "module": {
        specifierForNonTopLevel = foundModule.r;
        break;
      }
    }
    const awaitImportUrl = `await import(${JSON.stringify(specifierForNonTopLevel)})`;
    return [ktvalOther(`const{${ids.join(", ")}}=${awaitImportUrl};\n`)];
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
  async (
    env: Env,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (forms.length === 0) {
      return new TranspileError(
        "The number of arguments of `export` must be at least 1.",
      );
    }

    if (!EnvF.isAtTopLevel(env)) {
      return new TranspileError("`export` must be used at the top level.");
    }

    const result: Ktvals<JsSrc> = [];
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
      result.push(ktvalExport(), ...r);
    }
    return result;
  },
  exportableStatement,
);
