import { type Empty } from "../../util/types.js";

interface CuArrayBrand {
  readonly _CuArrayBrand: unique symbol;
}

class CuArrayBase<T, X extends Empty = Empty> extends Array<T> {
  constructor();
  constructor(extension: X);
  // Looks like this is a false positive.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  constructor(public extension: X = {} as X) {
    super();
  }
}

export interface CuArray<T, X extends Empty = Empty>
  extends CuArrayBase<T, X>,
    CuArrayBrand {}

export function cuArray<T>(...v: T[]): CuArray<T> {
  const result = new CuArrayBase<T>();
  result.push(...v);
  return result as CuArray<T>;
}

export function isCuArray(v: unknown): v is CuArrayBase<unknown> {
  return v instanceof CuArrayBase;
}
