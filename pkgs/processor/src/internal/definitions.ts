import {
  aNamespace,
  type FilePath,
  isWriter,
  type Namespace,
  TranspileError,
} from "./types.js";

// Path to the `lib` directory in the dist/ from this module.
export const standardModuleRoot = [
  "npm:@custard-lang",
  "processor",
  "dist",
  "lib",
  "",
].join("/");

export async function loadModule(
  path: FilePath,
): Promise<Namespace | TranspileError> {
  // TODO: Parse JavaScript source to avoid unsafe execution.
  const mod = (await import(path)) as { [key: string]: unknown };
  return asNamespace(mod, path);
}

function asNamespace(
  mod: { [key: string]: unknown },
  p: FilePath,
): Namespace | TranspileError {
  const ns = aNamespace();
  for (const [id, def] of Object.entries(mod)) {
    const unprefixed = id.replace(/^_cu\$/, "");
    if (unprefixed !== id && !isWriter(def)) {
      return new TranspileError(
        `Prefixed ${id} defined in ${p} should be a Custard's JavaScript Writer.`,
      );
    }
    ns[unprefixed] = def;
  }
  return ns;
}
