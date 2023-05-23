import {
  aConst,
  Definitions,
  FilePath,
  isWriter,
  TranspileError,
} from "./types.js";

// Path to the `lib` directory from this module.
export const standardModuleRoot = "../lib";

export async function loadModulePaths(paths: FilePath[]): Promise<Definitions | TranspileError> {
  const definitions: Definitions = new Map();
  for (const path of paths) {
    const r = await loadModulePathInto(path, definitions);
    if (r instanceof TranspileError) {
      return r;
    }
  }
  return definitions;
}

export async function loadModulePathInto(
  path: FilePath,
  definitions: Definitions,
): Promise<undefined | TranspileError> {
  // TODO: Parse JavaScript source to avoid unsafe execution.
  const mod = (await import(path)) as Record<string, unknown>;
  for (const [id, def] of Object.entries(mod)) {
    const unprefixed = id.replace(/^_cu\$/, "");
    if (isWriter(def)) {
      definitions.set(unprefixed, def);
      continue;
    }

    if (unprefixed !== id) {
      return new TranspileError(
        `Prefixed ${id} defined in ${path} should be a Custard's JavaScript Writer.`,
      );
    }
    definitions.set(id, aConst());
  }
}
