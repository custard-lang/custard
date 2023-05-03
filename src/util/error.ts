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

export async function mapJoinWithCommaAE<T, E extends Error>(
  xs: T[],
  klass: new () => E,
  f: (x: T) => Promise<string | E>,
): Promise<string | E> {
  let result = "";
  const lastI = xs.length - 1;
  for (const [i, x] of xs.entries()) {
    const r = await f(x);
    if (r instanceof klass) {
      return r;
    }
    result =
      i === lastI ? `${result}${r as string}` : `${result}${r as string},`;
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectNever(_: never): any {
  throw new Error("Assertion failure: Unreachable!");
}
