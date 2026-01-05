import * as ContextF from "../context.js";
import { loadModule } from "../definitions.js";
import {
  type CuSymbol,
  type Context,
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
  ktvalImportStarAs,
  ktvalExport,
  formatForError,
} from "../types.js";
import { transpileExpression } from "../transpile.js";
import { asExportableStatement } from "../call.js";

export const _cu$import = markAsDirectWriter(
  async (
    context: Context,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const moduleId = validateArgsOfImport(forms, "import");
    if (TranspileError.is(moduleId)) {
      return moduleId;
    }

    const foundModule = await ContextF.findModule(context, moduleId.value);
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

    const r = ContextF.set(context, moduleId.value, ns);
    if (TranspileError.is(r)) {
      return r;
    }

    const isTopLevel = ContextF.isAtTopLevel(context);
    ContextF.setImportedModulesJsId(context, foundModule, {
      id: moduleId.value,
      isTopLevel,
    });

    if (isTopLevel) {
      return [ktvalImportStarAs(foundModule.u, foundModule.r, moduleId.value)];
    }

    let specifier: string;
    switch (context.transpileState.mode) {
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
    context: Context,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    const moduleId = validateArgsOfImport(forms, "importAnyOf");
    if (TranspileError.is(moduleId)) {
      return moduleId;
    }

    const foundModule = await ContextF.findModule(context, moduleId.value);
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
    ContextF.mergeNamespaceIntoCurrentScope(context, ns);

    const ids: Id[] = [];
    for (const [id, w] of Object.entries(ns)) {
      if (!isWriter(w) || canBePseudoTopLevelReferenced(w)) {
        ids.push(id);
      }
    }

    const isTopLevel = ContextF.isAtTopLevel(context);
    for (const id of ids) {
      ContextF.setImportedModulesJsId(context, foundModule, {
        id,
        isTopLevel,
      });
    }

    if (isTopLevel) {
      return [ktvalImport(foundModule.u, foundModule.r, ids)];
    }

    let specifierForNonTopLevel: string;
    switch (context.transpileState.mode) {
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
    context: Context,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (forms.length === 0) {
      return new TranspileError(
        "The number of arguments of `export` must be at least 1.",
      );
    }

    if (!ContextF.isAtTopLevel(context)) {
      return new TranspileError("`export` must be used at the top level.");
    }

    const result: Ktvals<JsSrc> = [];
    for (const form of forms) {
      const stmt = asExportableStatement(context, form);
      if (TranspileError.is(stmt)) {
        return stmt;
      }
      if (stmt === undefined) {
        return new TranspileError(
          `The arguments of \`export\` must be an exportable declaration (e.g., \`const\`/\`let\`). But got ${formatForError(form)}.`,
        );
      }
      const r = await transpileExpression(form, context);
      if (TranspileError.is(r)) {
        return r;
      }
      result.push(ktvalExport(), ...r);
    }
    return result;
  },
  exportableStatement,
);
