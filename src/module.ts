import { aConst, FilePath, isWriter, Scope, TranspileError } from "./types.js";

export async function loadAsScope(paths: FilePath[]): Promise<Scope> {
  const scope: Scope = new Map();
  for (const path of paths) {
    await loadInto(path, scope);
  }
  return scope;
}

// Path to the `lib` directory from this module.
export const standardRoot = "./lib/";

export async function loadInto(
  path: string,
  scope: Scope,
): Promise<undefined | TranspileError> {
  const mod = (await import(path)) as Record<string, unknown>;
  for (const [id, def] of Object.entries(mod)) {
    const unprefixed = id.replace(/^_cu\$/, "");
    if (isWriter(def)) {
      scope.set(unprefixed, def);
      continue;
    }

    if (unprefixed !== id) {
      return new TranspileError(
        `Prefixed ${id} defined in ${path} should be a Custard's JavaScript Writer.`,
      );
    }
    scope.set(id, aConst());
  }
}
