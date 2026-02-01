import * as ContextF from "../context.js";
import { ModulePathAndUrl, specifierOfFoundModule } from "../context.js";
import { loadModule } from "../definitions.js";
import {
  aConst,
  type Context,
  type Form,
  type Id,
  isCuObject,
  isCuSymbol,
  isKeyValue,
  type JsSrc,
  markAsDirectWriter,
  TranspileError,
} from "../../types.js";
import {
  exportableStatement,
  formatForError,
  HowToRefer,
  isWriter,
  ktvalExport,
  ktvalImport,
  ktvalImportStarAs,
  ktvalOther,
  type Ktvals,
  ordinaryStatement,
} from "../types.js";
import { transpileExpression } from "../transpile.js";
import { asExportableStatement } from "../call.js";

export const _cu$import = markAsDirectWriter(
  async (
    context: Context,
    moduleId?: Form,
    idSpecs?: Form,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (forms.length !== 0) {
      return new TranspileError(
        "The number of arguments of `import` must be 1 or 2.",
      );
    }
    if (moduleId === undefined || !isCuSymbol(moduleId)) {
      return new TranspileError(
        "The first argument of `import` must be a Symbol.",
      );
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

    if (idSpecs !== undefined) {
      const ids = parseImportIdSpecs(idSpecs);
      if (TranspileError.is(ids)) {
        return ids;
      }

      for (const id of ids) {
        if (!Object.prototype.hasOwnProperty.call(ns, id)) {
          return new TranspileError(
            `\`${id}\` is not exported from \`${moduleId.value}\`.`,
          );
        }
        const setResult = ContextF.set(
          context,
          id,
          isWriter(ns[id]) ? ns[id] : aConst(),
        );
        if (TranspileError.is(setResult)) {
          return setResult;
        }
      }

      const isTopLevel = ContextF.isAtTopLevel(context);
      linkIdsAsJsIds(context, ids, isTopLevel, foundModule);

      if (isTopLevel) {
        return [ktvalImport(foundModule.u, foundModule.r, ids)];
      }

      const specifier = specifierOfFoundModule(context, foundModule);
      const awaitImportUrl = `await import(${JSON.stringify(specifier)})`;
      return [ktvalOther(`const{${ids.join(",")}}=${awaitImportUrl};\n`)];
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
    const specifier = specifierOfFoundModule(context, foundModule);
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
    moduleId?: Form,
    ...forms: Form[]
  ): Promise<Ktvals<JsSrc> | TranspileError> => {
    if (forms.length !== 0) {
      return new TranspileError(
        "The number of arguments of `importAnyOf` must be 1.",
      );
    }
    if (moduleId === undefined || !isCuSymbol(moduleId)) {
      return new TranspileError(
        "The argument of `importAnyOf` must be a Symbol.",
      );
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
      if (!isWriter(w)) {
        ids.push(id);
      }
    }

    const isTopLevel = ContextF.isAtTopLevel(context);
    linkIdsAsJsIds(context, ids, isTopLevel, foundModule);

    if (isTopLevel) {
      return [ktvalImport(foundModule.u, foundModule.r, ids)];
    }

    const specifierForNonTopLevel = specifierOfFoundModule(
      context,
      foundModule,
    );
    const awaitImportUrl = `await import(${JSON.stringify(specifierForNonTopLevel)})`;
    return [ktvalOther(`const{${ids.join(",")}}=${awaitImportUrl};\n`)];
  },
  ordinaryStatement,
);

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

function parseImportIdSpecs(idSpecs: Form): Id[] | TranspileError {
  if (!isCuObject(idSpecs)) {
    return new TranspileError(
      `The second argument of \`import\` must be an Object of Symbols. But got ${formatForError(idSpecs)}.`,
    );
  }

  const ids: Id[] = [];
  for (const spec of idSpecs.keyValues) {
    if (isCuSymbol(spec)) {
      ids.push(spec.value);
      continue;
    }
    if (isKeyValue(spec)) {
      if (
        isCuSymbol(spec.key) &&
        isCuSymbol(spec.value) &&
        spec.key.value === spec.value.value
      ) {
        ids.push(spec.value.value);
        continue;
      }
    }
    return new TranspileError(
      `The second argument of \`import\` must be an Object of Symbols. But got ${formatForError(idSpecs)}.`,
    );
  }
  return ids;
}

function linkIdsAsJsIds(
  context: Context,
  ids: Id[],
  isTopLevel: boolean,
  foundModule: ModulePathAndUrl,
): void {
  const howToReferById = new Map<Id, HowToRefer>();
  for (const id of ids) {
    howToReferById.set(id, { id, isTopLevel });
  }
  ContextF.setImportedModulesJsIds(context, foundModule, howToReferById);
}
