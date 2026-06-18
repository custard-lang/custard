export function logDirectoryOf(appName: string): string {
  if (process.env.XDG_STATE_HOME) {
    return process.env.XDG_STATE_HOME;
  }
  switch (process.platform) {
    case "win32": {
      const appData =
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        process.env.APPDATA || `${process.env.HOME}/AppData/Roaming`;
      // The "Logs" folder is not standard, but would be useful for many applications.
      return `${appData}\\${appName}\\Logs`;
    }
    case "darwin":
      // Ref. https://aiotter.com/posts/macos-directory-structure/
      return `${process.env.HOME}/Library/Logs/${appName}`;
    default:
      // Ref. https://specifications.freedesktop.org/basedir-spec/latest/#variables
      return `${process.env.HOME}/.local/state/${appName}`;
  }
}
