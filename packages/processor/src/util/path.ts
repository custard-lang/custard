import * as os from "node:os";
import * as path from "node:path";

import { assertNonNull } from "./error.js";

export function fileOfImportMetaUrl(importMetaUrl: string): string {
  return dropLeadingSlashOnWindows(new URL(importMetaUrl).pathname);
}

export function dirOfImportMetaUrl(importMetaUrl: string): string {
  return path.dirname(fileOfImportMetaUrl(importMetaUrl));
}

function dropLeadingSlashOnWindows(pathname: string): string {
  return os.platform() === "win32" ? pathname.slice(1) : pathname;
}

export function parseAbsoluteUrl(pathname: string): [string, string] | null {
  const md = /^(node|npm|file):(.*)/.exec(pathname);
  if (md === null) {
    return null;
  }
  return [
    assertNonNull(md[1], "Assertion failure: No scheme captured"),
    assertNonNull(md[2], "Assertion failure: No scheme-specific-part captured"),
  ];
}

export function isAbsoluteUrl(pathname: string): boolean {
  return parseAbsoluteUrl(pathname) !== null;
}

export function projectRootFromImportMetaUrl(importMetaUrl: string): string {
  // Example import.meta.url in Vite: file:///S:/prj/custard/packages/processor/src/internal/definitions.ts
  // Example import.meta.url in dist: file:///S:/prj/custard/packages/processor/dist/src/internal/definitions.js
  const packageRootOrDist = path.dirname(
    path.dirname(dirOfImportMetaUrl(importMetaUrl)),
  );
  if (path.basename(packageRootOrDist) === "dist") {
    return path.dirname(packageRootOrDist);
  }
  return path.dirname(path.dirname(packageRootOrDist));
}
