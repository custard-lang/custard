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

// TODO: Remove this function and use `ExpectNever` instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectNever(_: never): any {
  throw new Error("Assertion failure: Unreachable!");
}

// e.g. throw ExpectNever(x);
export function ExpectNever(x: never): Error {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return new Error(`Assertion failure: Unreachable: ${x}`);
}
