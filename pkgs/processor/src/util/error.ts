export function assertNonError<T>(v: T | Error): T {
  if (v instanceof Error) {
    throw v;
  }
  return v;
}

export function assertNonNull<T>(v: T | undefined, msg: string): T {
  if (v === undefined) {
    throw new Error(msg);
  }
  return v;
}

// e.g. throw ExpectNever(x);
export function ExpectNever(x: never): Error {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return new Error(`Assertion failure: Unreachable: ${x}`);
}

export function isFileNotFoundError(e: unknown): boolean {
  // There's no way to distinguish the "Not Found" error from the other errors except for using `any`!
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return e instanceof Error && (e as { [key: string]: any }).code === "ENOENT";
}
