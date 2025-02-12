import type { Empty } from "../../util/types.js";

export class ReservedSymbol<X extends Empty = Empty> {
  readonly #value: boolean | null;

  public extension: X = {} as X;

  constructor(value: boolean | null) {
    this.#value = value;
  }

  valueOf(): boolean | null {
    return this.#value;
  }
}

export function reservedSymbol(v: boolean | null): ReservedSymbol {
  return new ReservedSymbol(v);
}

export function isReservedSymbol(v: unknown): v is ReservedSymbol {
  return v instanceof ReservedSymbol;
}
