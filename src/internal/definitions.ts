import * as path from "node:path";

import * as MapU from "../util/map.js";
import { pathOfImportMetaUrl } from "../util/path.js";

import {
  aConst,
  Definitions,
  FilePath,
  isWriter,
  TranspileError,
} from "./types.js";

// Path to the `lib` directory in the dist/ from this module.
export const standardModuleRoot = [
  path.dirname(
    path.dirname(
      path.dirname(
        pathOfImportMetaUrl(import.meta.url),
      ),
    ),
  ),
  "dist",
  "src",
  "lib",
].join("/");


export async function loadModulePaths(
  paths: FilePath[],
): Promise<Definitions | TranspileError> {
  const definitions: Definitions = new Map();
  for (const path of paths) {
    const r = await loadModulePath(path);
    if (r instanceof TranspileError) {
      return r;
    }
    MapU.mergeFromTo(r, definitions);
  }
  return definitions;
}

export async function loadModulePath(
  path: FilePath,
): Promise<Definitions | TranspileError> {
  const definitions: Definitions = new Map();
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
  return definitions;
}
