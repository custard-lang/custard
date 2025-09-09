import { describe, expect, test } from "vitest";

import type { Context } from "@custard-lang/processor/dist/internal/types.js";
import {
  assumeIsFile,
  aVar,
  defaultTranspileOptions,
  TranspileError,
} from "@custard-lang/processor/dist/internal/types.js";
import { cuSymbol } from "@custard-lang/processor/dist/types.js";
import * as ContextF from "@custard-lang/processor/dist/internal/context.js";
import { transpileRepl } from "@custard-lang/processor/dist/internal/transpile-state.js";
import { fileOfImportMetaUrl } from "@custard-lang/processor/dist/util/path.js";
import { assertNonError } from "@custard-lang/processor/dist/util/error.js";

// I want to use underscore in the variable name for the delimiters of numbers.
/* eslint @typescript-eslint/naming-convention: 0 */

// The result of ContextF.set is unnecessary in this test.
/* eslint eslint-plugin-no-ignore-returned-union/no-ignore-returned-union: 0 */

function inScope(context: Context, f: () => void): void {
  ContextF.push(context);
  f();
  ContextF.pop(context);
}

function subjectContext(): Context {
  const from = assumeIsFile(fileOfImportMetaUrl(import.meta.url));
  return assertNonError(
    ContextF.init(
      transpileRepl(defaultTranspileOptions()),
      {
        implicitStatements: "",
        modulePaths: new Map(),
        jsTopLevels: [],
      },
      from,
    ),
  ) as Context;
}

describe("Interactions of the functions in ContextF", () => {
  test("referTo returns the set variable, and logs the reference to the variable", () => {
    const context = subjectContext();

    // Scope 0
    const v0_0v = aVar();
    ContextF.set(context, "v0_0", v0_0v);
    const w0_0 = ContextF.referTo(
      context,
      cuSymbol("v0_0"),
    ) as ContextF.WriterWithIsAtTopLevel;
    expect(w0_0.writer).toBe(v0_0v);
    expect(context.references.referenceById.get("v0_0")).toEqual([
      {
        referer: [0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      },
    ]);

    const v0_1v = aVar();
    ContextF.set(context, "v0_1", v0_1v);

    // Scope 0-0
    inScope(context, () => {
      const w0_0 = ContextF.referTo(
        context,
        cuSymbol("v0_0"),
      ) as ContextF.WriterWithIsAtTopLevel;
      expect(w0_0.writer).toBe(v0_0v);
      expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
        referer: [0, 0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      });

      const w0_1 = ContextF.referTo(
        context,
        cuSymbol("v0_1"),
      ) as ContextF.WriterWithIsAtTopLevel;
      expect(w0_1.writer).toBe(v0_1v);
      expect(context.references.referenceById.get("v0_1")).toEqual([
        {
          referer: [0, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        },
      ]);

      const v00_0v = aVar();
      ContextF.set(context, "v00_0", v00_0v);

      // Scope 0-0-0
      inScope(context, () => {
        const w0_0 = ContextF.referTo(
          context,
          cuSymbol("v0_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [0, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = ContextF.referTo(
          context,
          cuSymbol("v0_1"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [0, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w00_0 = ContextF.referTo(
          context,
          cuSymbol("v00_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w00_0.writer).toBe(v00_0v);
        expect(context.references.referenceById.get("v00_0")).toEqual([
          {
            referer: [0, 0, 0],
            referee: {
              scopePath: [0, 0],
              id: "v00_0",
            },
          },
        ]);
      });

      // Scope 0-0-1
      inScope(context, () => {
        const w0_0 = ContextF.referTo(
          context,
          cuSymbol("v0_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [1, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = ContextF.referTo(
          context,
          cuSymbol("v0_1"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [1, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w00_0 = ContextF.referTo(
          context,
          cuSymbol("v00_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w00_0.writer).toBe(v00_0v);
        expect(context.references.referenceById.get("v00_0")?.at(-1)).toEqual({
          referer: [1, 0, 0],
          referee: {
            scopePath: [0, 0],
            id: "v00_0",
          },
        });
      });
    });

    // Scope 0-1
    inScope(context, () => {
      const w0_0 = ContextF.referTo(
        context,
        cuSymbol("v0_0"),
      ) as ContextF.WriterWithIsAtTopLevel;
      expect(w0_0.writer).toBe(v0_0v);
      expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
        referer: [1, 0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      });

      const w0_1 = ContextF.referTo(
        context,
        cuSymbol("v0_1"),
      ) as ContextF.WriterWithIsAtTopLevel;
      expect(w0_1.writer).toBe(v0_1v);
      expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
        referer: [1, 0],
        referee: {
          scopePath: [0],
          id: "v0_1",
        },
      });

      const v01_0v = aVar();
      ContextF.set(context, "v01_0", v01_0v);

      // Scope 0-1-0
      inScope(context, () => {
        const w0_0 = ContextF.referTo(
          context,
          cuSymbol("v0_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [0, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = ContextF.referTo(
          context,
          cuSymbol("v0_1"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [0, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = ContextF.referTo(
          context,
          cuSymbol("v01_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v01_0v);
        expect(context.references.referenceById.get("v01_0")).toEqual([
          {
            referer: [0, 1, 0],
            referee: {
              scopePath: [1, 0],
              id: "v01_0",
            },
          },
        ]);
      });

      // Scope 0-1-1
      inScope(context, () => {
        const w0_0 = ContextF.referTo(
          context,
          cuSymbol("v0_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [1, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = ContextF.referTo(
          context,
          cuSymbol("v0_1"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [1, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = ContextF.referTo(
          context,
          cuSymbol("v01_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v01_0v);
        expect(context.references.referenceById.get("v01_0")?.at(-1)).toEqual({
          referer: [1, 1, 0],
          referee: {
            scopePath: [1, 0],
            id: "v01_0",
          },
        });
      });
    });

    // Scope 0-2
    inScope(context, () => {
      const w0_0 = ContextF.referTo(
        context,
        cuSymbol("v0_0"),
      ) as ContextF.WriterWithIsAtTopLevel;
      expect(w0_0.writer).toBe(v0_0v);
      expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
        referer: [2, 0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      });

      const w0_1 = ContextF.referTo(
        context,
        cuSymbol("v0_1"),
      ) as ContextF.WriterWithIsAtTopLevel;
      expect(w0_1.writer).toBe(v0_1v);
      expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
        referer: [2, 0],
        referee: {
          scopePath: [0],
          id: "v0_1",
        },
      });

      const v02_0v = aVar();
      ContextF.set(context, "v02_0", v02_0v);

      // Scope 0-2-0
      inScope(context, () => {
        const w0_0 = ContextF.referTo(
          context,
          cuSymbol("v0_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [0, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = ContextF.referTo(
          context,
          cuSymbol("v0_1"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [0, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = ContextF.referTo(
          context,
          cuSymbol("v02_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v02_0v);
        expect(context.references.referenceById.get("v02_0")).toEqual([
          {
            referer: [0, 2, 0],
            referee: {
              scopePath: [2, 0],
              id: "v02_0",
            },
          },
        ]);
      });

      // Scope 0-2-1
      inScope(context, () => {
        const w0_0 = ContextF.referTo(
          context,
          cuSymbol("v0_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [1, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = ContextF.referTo(
          context,
          cuSymbol("v0_1"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [1, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = ContextF.referTo(
          context,
          cuSymbol("v02_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v02_0v);
        expect(context.references.referenceById.get("v02_0")?.at(-1)).toEqual({
          referer: [1, 2, 0],
          referee: {
            scopePath: [2, 0],
            id: "v02_0",
          },
        });
      });

      // Scope 0-2-2
      inScope(context, () => {
        const w0_0 = ContextF.referTo(
          context,
          cuSymbol("v0_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(context.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [2, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = ContextF.referTo(
          context,
          cuSymbol("v0_1"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(context.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [2, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = ContextF.referTo(
          context,
          cuSymbol("v02_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v02_0v);
        expect(context.references.referenceById.get("v02_0")?.at(-1)).toEqual({
          referer: [2, 2, 0],
          referee: {
            scopePath: [2, 0],
            id: "v02_0",
          },
        });

        const v022_0v = aVar();
        ContextF.set(context, "v022_0", v022_0v);

        const w022_0 = ContextF.referTo(
          context,
          cuSymbol("v022_0"),
        ) as ContextF.WriterWithIsAtTopLevel;
        expect(w022_0.writer).toBe(v022_0v);
        expect(context.references.referenceById.get("v022_0")?.at(-1)).toEqual({
          referer: [2, 2, 0],
          referee: {
            scopePath: [2, 2, 0],
            id: "v022_0",
          },
        });
      });
    });
  });

  describe("set returns an error if the variable is referred to as an outer variable", () => {
    test("1: the variable is recursively referred", () => {
      const context = subjectContext();

      expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

      ContextF.referTo(context, cuSymbol("v0"));
      expect(ContextF.set(context, "v1", aVar())).toBeUndefined();

      inScope(context, () => {
        ContextF.referTo(context, cuSymbol("v0"));
        expect(ContextF.set(context, "v0", aVar())).toEqual(
          new TranspileError(
            "No variable `v0` is defined! NOTE: If you want to define `v0` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );
      });
    });

    test("2: the variable is recursively referred in the inner scope", () => {
      const context = subjectContext();

      expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

      ContextF.referTo(context, cuSymbol("v0"));
      expect(ContextF.set(context, "v1", aVar())).toBeUndefined();

      inScope(context, () => {
        inScope(context, () => {
          ContextF.referTo(context, cuSymbol("v0"));
        });
        expect(ContextF.set(context, "v0", aVar())).toEqual(
          new TranspileError(
            "No variable `v0` is defined! NOTE: If you want to define `v0` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );
      });
    });

    test("3: the variable is back-referred", () => {
      const context = subjectContext();

      expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

      ContextF.referTo(context, cuSymbol("v0"));
      expect(ContextF.set(context, "v1", aVar())).toBeUndefined();

      inScope(context, () => {
        ContextF.referTo(context, cuSymbol("v1"));
        expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

        expect(ContextF.set(context, "v1", aVar())).toEqual(
          new TranspileError(
            "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );

        inScope(context, () => {
          ContextF.referTo(context, cuSymbol("v1"));
          expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

          expect(ContextF.set(context, "v1", aVar())).toEqual(
            new TranspileError(
              "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
            ),
          );
        });
      });
    });

    test("4: the variable is back-referred in the inner scope", () => {
      const context = subjectContext();

      expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

      ContextF.referTo(context, cuSymbol("v0"));
      expect(ContextF.set(context, "v1", aVar())).toBeUndefined();

      inScope(context, () => {
        inScope(context, () => {
          ContextF.referTo(context, cuSymbol("v1"));
        });
        expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

        expect(ContextF.set(context, "v1", aVar())).toEqual(
          new TranspileError(
            "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );

        inScope(context, () => {
          inScope(context, () => {
            ContextF.referTo(context, cuSymbol("v1"));
          });
          expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

          expect(ContextF.set(context, "v1", aVar())).toEqual(
            new TranspileError(
              "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
            ),
          );
        });
      });
    });
  });

  test("set returns undefined if the variable is referred to *not* actually as an outer variable", () => {
    const context = subjectContext();

    expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

    ContextF.referTo(context, cuSymbol("v0"));
    expect(ContextF.set(context, "v1", aVar())).toBeUndefined();

    inScope(context, () => {
      expect(ContextF.set(context, "v0", aVar())).toBeUndefined();

      ContextF.referTo(context, cuSymbol("v0"));
      expect(ContextF.set(context, "v1", aVar())).toBeUndefined();

      inScope(context, () => {
        ContextF.referTo(context, cuSymbol("v1"));
      });
      expect(ContextF.set(context, "v2", aVar())).toBeUndefined();
    });
  });
});
