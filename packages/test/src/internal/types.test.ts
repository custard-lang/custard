import { describe, expect, test } from "vitest";

import {
  jsValueToForm,
  TranspileError,
} from "@custard-lang/processor/dist/internal/types.js";
import {
  type Form,
  cuArray,
  cuObject,
  cuString,
  cuSymbol,
  float64,
  integer32,
  keyValue,
  reservedSymbol,
} from "@custard-lang/processor/dist/types.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-function  */

describe("jsValueToForm", () => {
  test("converts JS values into a Form", () => {
    const actual = jsValueToForm([
      ["1", 2],
      null,
      [true],
      false,
      [],
      [[9]],
      { a: "b", c: { d: 4 } },
    ]);
    const expected = cuArray<Form>(
      cuArray<Form>(cuString("1"), float64(2)),
      reservedSymbol(null),
      cuArray(reservedSymbol(true)),
      reservedSymbol(false),
      cuArray(),
      cuArray(cuArray(float64(9))),
      cuObject<Form, Form, Form, Form>(
        keyValue<Form, Form, Form>(cuString("a"), cuString("b")),
        keyValue<Form, Form, Form>(
          cuString("c"),
          cuObject<Form, Form, Form, Form>(
            keyValue<Form, Form, Form>(cuString("d"), float64(4)),
          ),
        ),
      ),
    );
    expect(actual).toEqual(expected);
  });

  test("converts JS values containing Forms and Forms containing JS values", () => {
    const actual = jsValueToForm([
      ["1", 2],
      reservedSymbol(null),
      [true],
      undefined,
      [cuString("form")],
      [cuArray<any>([9], integer32(-1))],
      {
        a: "b",
        c: { d: cuObject<any, any, any, any>(keyValue(cuSymbol("k"), 9)) },
      },
    ]);
    const expected = cuArray<Form>(
      cuArray<Form>(cuString("1"), float64(2)),
      reservedSymbol(null),
      cuArray(reservedSymbol(true)),
      reservedSymbol(null),
      cuArray(cuString("form")),
      cuArray(cuArray<Form>(cuArray(float64(9)), integer32(-1))),
      cuObject<Form, Form, Form, Form>(
        keyValue<Form, Form, Form>(cuString("a"), cuString("b")),
        keyValue<Form, Form, Form>(
          cuString("c"),
          cuObject<Form, Form, Form, Form>(
            keyValue<Form, Form, Form>(
              cuString("d"),
              cuObject<Form, Form, Form, Form>(
                keyValue<Form, Form, Form>(cuSymbol("k"), float64(9)),
              ),
            ),
          ),
        ),
      ),
    );
    expect(actual).toEqual(expected);
  });

  test("returns a TranspileError if the JS value contains a function", () => {
    expect(jsValueToForm({ f: () => {} })).toEqual(
      new TranspileError("Cannot convert a Function to a Form."),
    );
  });

  test("returns a TranspileError if the JS value contains a Promise", () => {
    expect(jsValueToForm({ p: new Promise(() => {}) })).toEqual(
      new TranspileError("Cannot convert a Promise to a Form."),
    );
  });

  test("returns a TranspileError if the JS value contains a Symbol", () => {
    expect(jsValueToForm(Symbol("symbol for testing"))).toEqual(
      new TranspileError("Cannot convert a Symbol to a Form."),
    );
  });

  // TODO: Map, Set, BigInt, Date, RegExp, Error, ArrayBuffer, DataView, TypedArray, WeakMap, WeakSet, etc.

  // TODO: Circular reference
});
