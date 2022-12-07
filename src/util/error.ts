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

export function mapE<T, U, E extends Error>(
  xs: Iterable<T>,
  klass: new () => E,
  f: (x: T) => U | E,
): U[] | E {
  const result: U[] = [];
  for (const x of xs) {
    const r = f(x);
    if (r instanceof klass) {
      return r;
    }
    result.push(r as U);
  }
  return result;
}
