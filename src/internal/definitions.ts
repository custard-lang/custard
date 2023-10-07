import { projectRootFromImportMetaUrl } from "../util/path.js";

import {
  aConst,
  aNamespace,
  FilePath,
  isWriter,
  Namespace,
  TranspileError,
} from "./types.js";

// Path to the `lib` directory in the dist/ from this module.
export const standardModuleRoot = [
  projectRootFromImportMetaUrl(import.meta.url),
  "dist",
  "src",
  "lib",
].join("/");

export async function loadModule(
  path: FilePath,
): Promise<Namespace | TranspileError> {
  // TODO: Parse JavaScript source to avoid unsafe execution.
  const mod = (await import(path)) as Record<string, unknown>;
  return asNamespace(mod, path);
}

export function asNamespace(
  mod: Record<string, unknown>,
  p: FilePath,
): Namespace | TranspileError {
  const ns = aNamespace();
  for (const [id, def] of Object.entries(mod)) {
    const unprefixed = id.replace(/^_cu\$/, "");
    if (isWriter(def)) {
      ns.definitions.set(unprefixed, def);
      continue;
    }

    if (unprefixed !== id) {
      return new TranspileError(
        `Prefixed ${id} defined in ${p} should be a Custard's JavaScript Writer.`,
      );
    }
    ns.definitions.set(id, aConst());
  }
  return ns;
}
