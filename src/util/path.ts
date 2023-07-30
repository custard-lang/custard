import * as os from "node:os";

export function pathOfImportMetaUrl(importMetaUrl: string): string {
  return dropLeadingSlashOnWindows(new URL(importMetaUrl).pathname);
}

function dropLeadingSlashOnWindows(pathname: string): string {
  return os.platform() === "win32" ? pathname.slice(1) : pathname;
}
