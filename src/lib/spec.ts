export type SpecId = string | symbol;

// TODO: more informative: { t: "String" } | { t: "Array", e: BaseStructure[] } | { t: "Map", k: BaseStructure, v: BaseStructure } | ...
export type BaseStructure = "String" | "Array" | "Map" | "Record" | "Or";

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
}

export const withId = <T>(id: SpecId, spec: Spec<T>): Spec<T> => ({
  ...spec,
  id,
});

/* TODO
export const mapSpec

export const andMap

export const and
*/

// prettier-ignore
export interface Or {
  <T1, T2>(s1: Spec<T1>, s2: Spec<T2>): Spec<T1 | T2>;
  <T1, T2, T3>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>): Spec<T1 | T2 | T3>;
  <T1, T2, T3, T4>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>): Spec<T1 | T2 | T3 | T4>;
  <T1, T2, T3, T4, T5>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>): Spec<T1 | T2 | T3 | T4 | T5>;
  <T1, T2, T3, T4, T5, T6>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>): Spec<T1 | T2 | T3 | T4 | T5 | T6>;
  <T1, T2, T3, T4, T5, T6, T7>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7>;
  <T1, T2, T3, T4, T5, T6, T7, T8>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>, s14: Spec<T14>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>, s14: Spec<T14>, s15: Spec<T15>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14 | T15>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>, s14: Spec<T14>, s15: Spec<T15>, s16: Spec<T16>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14 | T15 | T16>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>, s14: Spec<T14>, s15: Spec<T15>, s16: Spec<T16>, s17: Spec<T17>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14 | T15 | T16 | T17>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>, s14: Spec<T14>, s15: Spec<T15>, s16: Spec<T16>, s17: Spec<T17>, s18: Spec<T18>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14 | T15 | T16 | T17 | T18>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>, s14: Spec<T14>, s15: Spec<T15>, s16: Spec<T16>, s17: Spec<T17>, s18: Spec<T18>, s19: Spec<T19>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14 | T15 | T16 | T17 | T18 | T19>;
  <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20>(s1: Spec<T1>, s2: Spec<T2>, s3: Spec<T3>, s4: Spec<T4>, s5: Spec<T5>, s6: Spec<T6>, s7: Spec<T7>, s8: Spec<T8>, s9: Spec<T9>, s10: Spec<T10>, s11: Spec<T11>, s12: Spec<T12>, s13: Spec<T13>, s14: Spec<T14>, s15: Spec<T15>, s16: Spec<T16>, s17: Spec<T17>, s18: Spec<T18>, s19: Spec<T19>, s20: Spec<T20>): Spec<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14 | T15 | T16 | T17 | T18 | T19 | T20>;
}

export const or: Or = (...ss: Spec<unknown>[]): Spec<unknown> => {
  return {
    id: "Or",
    base: "Or",
    validate(x: unknown, path: Breadcrumbs = []): unknown | ValidationError {
      for (const s of ss) {
        const r = s.validate(x, path);
        if (!(r instanceof ValidationError)) {
          return r;
        }
      }
      return new ValidationError("Or", typeof x, path);
    },
  };
};

export interface Tuple {
  <TS>(...ss: Spec<TS>[]): Spec<TS[]>;
}

export type Concat = {
  <TSS>(...sss: Spec<TSS[]>[]): Spec<TSS[]>;
};

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
        if (r instanceof ValidationError) {
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
        if (r instanceof ValidationError) {
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
        if (keyR instanceof ValidationError) {
          return keyR;
        }

        const valR = valueSpec.validate(val, [...path, key]);
        if (valR instanceof ValidationError) {
          return valR;
        }

        result.set(keyR, valR);
      }
      return result;
    },
  };
};
