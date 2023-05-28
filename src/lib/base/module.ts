import * as EnvF from "../../internal/env.js";
import { loadModulePathInto, standardModuleRoot } from "../../definitions.js";
import {
  aNamespace,
  CuArray,
  CuSymbol,
  Env,
  isCuSymbol,
  isLiteralArray,
  JsSrc,
  LiteralArray,
  literalArray,
  markAsDirectWriter,
  TranspileError,
} from "../../internal/types.js";
import { pseudoTopLevelAssignment } from "../../internal/cu-env.js";

export const standardRoot = standardModuleRoot;

export const _cu$import = markAsDirectWriter(
  async (env: Env, ...forms: CuArray): Promise<JsSrc | TranspileError> => {
    if (forms.length > 2) {
      return new TranspileError(
        "The number of arguments of `import` must be 1.",
      );
    }
    const [modId] = forms;
    if (!isCuSymbol(modId)) {
      return new TranspileError(
        "The first argument of `import` must be a Symbol.",
      );
    }

    let exportsTmp = forms[1];
    if (exportsTmp === undefined) {
      exportsTmp = literalArray([]);
    } else if (!isLiteralArray(exportsTmp)) {
      return new TranspileError(
        "The second argument of `import` must be a LiteralArray.",
      );
    }
    const exports = exportsTmp;

    const foundModule = EnvF.findModule(env, modId.v);
    if (foundModule === undefined) {
      return new TranspileError(
        `No module \`${modId.v}\` registered in the Module Paths`,
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

    const r2 = EnvF.set(env, modId.v, ns);
    if (r2 instanceof TranspileError) {
      return r2;
    }

    // TODO: Rewrite with `transpilingForVariableDeclaration`
    const awaitImport = `await import(${JSON.stringify(foundModule.url)})`;
    let importStatement: JsSrc;
    let assignExports: JsSrc;
    if (EnvF.isAtTopLevel(env)) {
      switch (env.transpileState.mode) {
        case "repl":
          importStatement = pseudoTopLevelAssignment(modId, awaitImport);
          assignExports = buildAssignExportsAsPseudoTopLevelReference(
            modId,
            exports,
          );
          break;
        case "module":
          importStatement = `import * as ${modId.v} from ${JSON.stringify(
            foundModule.relativePath,
          )}`;
          assignExports = buildAssignExports(modId, exports);
          break;
      }
    } else {
      importStatement = `const ${modId.v} = ${awaitImport}`;
      assignExports = buildAssignExports(modId, exports);
    }
    return `${importStatement}\n${assignExports}`;
  },
);

function buildAssignExports(modId: CuSymbol, exports: LiteralArray): JsSrc {
  throw new Error("Function not implemented.");
}

function buildAssignExportsAsPseudoTopLevelReference(
  modId: CuSymbol,
  exports: LiteralArray,
): JsSrc {
  throw new Error("Function not implemented.");
}
