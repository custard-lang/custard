export type SpecId = string | symbol;

// TODO: more informative: { t: "String" } | { t: "Array", e: BaseStructure[] } | { t: "Map", k: BaseStructure, v: BaseStructure } | ...
export type BaseStructure = "String" | "Array" | "Map" | "Record";

export type Breadcrumbs = (string | number | symbol)[];

export interface Spec<T> {
  readonly id: SpecId;
  readonly base: BaseStructure;
  validate(x: unknown, path?: Breadcrumbs): T | ValidationError;
  // TODO: generate any value of T, JSON.stringify(T), JSON.parse(T), and more!
}

export class ValidationError extends Error {
  override name = "ValidationError";

  constructor(
    public readonly expected: BaseStructure,
    public readonly actual: string,
    public readonly path: Breadcrumbs,
  ) {
    super(`Expected: ${expected}, Actual: ${actual} (at ${path.join("/")})`);
  }

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isValidationError = true;
  static is(e: unknown): e is ValidationError {
    return (e as Record<string, unknown>)?._cu$isValidationError === true;
  }
}

export const withId = <T>(id: SpecId, spec: Spec<T>): Spec<T> => ({
  ...spec,
  id,
});

/* TODO
export const mapSpec

export const andMap

export const and

export const or
*/

export const record = <T>(keyAndSpecs: {
  [K in keyof T]: Spec<T[K]>;
}): Spec<T> => {
  return {
    id: "Record",
    base: "Record",
    validate(x: unknown, path: Breadcrumbs = []): T | ValidationError {
      if (x === null) {
        return new ValidationError("Record", "null", path);
      }
      if (typeof x !== "object") {
        return new ValidationError("Record", typeof x, path);
      }

      const leftKeys = new Set(Object.keys(keyAndSpecs));
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const result: any = {};
      for (const [k, v] of Object.entries(x)) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const s = (keyAndSpecs as Record<string, Spec<any>>)[k];
        if (!s) {
          return new ValidationError(
            "Record",
            `Record with an extra key ${JSON.stringify(k)}`,
            path,
          );
        }
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
        const r = s.validate(v, [...path, k]);
        if (ValidationError.is(r)) {
          return r;
        }
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        result[k] = r;
        void leftKeys.delete(k);
      }

      if (leftKeys.size > 0) {
        return new ValidationError(
          "Record",
          `Record with missing keys ${[...leftKeys].join(", ")}`,
          path,
        );
      }

      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return */
      return result;
    },
  };
};

export const array = <T>(elementSpec: Spec<T>): Spec<T[]> => {
  return {
    id: "Array",
    base: "Array",
    validate(x: unknown, path: Breadcrumbs = []): T[] | ValidationError {
      if (!(x instanceof Array)) {
        return new ValidationError("Array", typeof x, path);
      }
      const result: T[] = [];
      for (const [i, element] of x.entries()) {
        const r = elementSpec.validate(element, [...path, i]);
        if (ValidationError.is(r)) {
          return r;
        }
        result.push(r);
      }
      return result;
    },
  };
};
export const string: Spec<string> = {
  id: "String",
  base: "String",
  validate(x: unknown, path: Breadcrumbs = []): string | ValidationError {
    if (typeof x !== "string") {
      return new ValidationError("String", typeof x, path);
    }
    return x;
  },
};
export const map = <K, V>(
  keySpec: Spec<K>,
  valueSpec: Spec<V>,
): Spec<Map<K, V>> => {
  return {
    id: "Map",
    base: "Map",
    validate(x: unknown, path: Breadcrumbs = []): Map<K, V> | ValidationError {
      if (!(x instanceof Map)) {
        return new ValidationError("Map", typeof x, path);
      }
      const result = new Map<K, V>();
      for (const [key, val] of x.entries()) {
        const keyR = keySpec.validate(key, path);
        if (ValidationError.is(keyR)) {
          return keyR;
        }

        const valR = valueSpec.validate(val, [...path, key]);
        if (ValidationError.is(valR)) {
          return valR;
        }

        result.set(keyR, valR);
      }
      return result;
    },
  };
};
