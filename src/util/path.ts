import * as os from "node:os";
import * as path from "node:path";

export function projectRootFromImportMetaUrl(importMetaUrl: string): string {
  // Example in Vite: S:/prj/custard/src/internal/definitions.ts
  // Example in dist: S:/prj/custard/dist/src/internal/definitions.js
  const filePath = dropLeadingSlashOnWindows(new URL(importMetaUrl).pathname);
  const rootOrDist = path.dirname(path.dirname(path.dirname(filePath)));
  if (path.basename(rootOrDist) === "dist") {
    return path.dirname(rootOrDist);
  }
  return rootOrDist;
}

function dropLeadingSlashOnWindows(pathname: string): string {
  return os.platform() === "win32" ? pathname.slice(1) : pathname;
}
