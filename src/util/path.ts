import * as os from "node:os";
import * as path from "node:path";

export function projectRootFromImportMetaUrl(importMetaUrl: string): string {
  // Example import.meta.url in Vite: file:///S:/prj/custard/src/internal/definitions.ts
  // Example import.meta.url in dist: file:///S:/prj/custard/dist/src/internal/definitions.js
  const rootOrDist = path.dirname(
    path.dirname(dirOfImportMetaUrl(importMetaUrl)),
  );
  if (path.basename(rootOrDist) === "dist") {
    return path.dirname(rootOrDist);
  }
  return rootOrDist;
}

export function fileOfImportMetaUrl(importMetaUrl: string): string {
  return dropLeadingSlashOnWindows(new URL(importMetaUrl).pathname);
}

export function dirOfImportMetaUrl(importMetaUrl: string): string {
  return path.dirname(fileOfImportMetaUrl(importMetaUrl));
}

function dropLeadingSlashOnWindows(pathname: string): string {
  return os.platform() === "win32" ? pathname.slice(1) : pathname;
}
