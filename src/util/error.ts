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

export async function mapAE<T, U, E extends Error>(
  xs: Iterable<T>,
  klass: new () => E,
  f: (x: T) => Promise<U | E>,
): Promise<U[] | E> {
  const result: U[] = [];
  for (const x of xs) {
    const r = await f(x);
    if (r instanceof klass) {
      return r;
    }
    result.push(r as U);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectNever(_: never): any {
  /* empty */
}
