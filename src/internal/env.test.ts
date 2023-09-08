import { describe, expect, test } from "vitest";

import type { Env } from "./types.js";
import {
  aVar,
  cuSymbol,
  defaultTranspileOptions,
  TranspileError,
} from "../internal/types.js";
import * as EnvF from "./env.js";
import { transpileRepl } from "./transpile-state.js";
import { fileOfImportMetaUrl } from "../util/path.js";

function inScope(env: Env, f: () => void): void {
  EnvF.push(env);
  f();
  EnvF.pop(env);
}

async function subjectEnv(): Promise<Env> {
  return EnvF.init(await transpileRepl(defaultTranspileOptions()), {
    from: fileOfImportMetaUrl(import.meta.url),
    implicitStatements: "",
    modulePaths: new Map(),
    jsTopLevels: [],
  });
}

describe("Interactions of the functions in EnvF", () => {
  test("referTo returns the set variable, and logs the reference to the variable", async () => {
    const env = await subjectEnv();

    // Scope 0
    const v0_0v = aVar();
    EnvF.set(env, "v0_0", v0_0v);
    const w0_0 = EnvF.referTo(
      env,
      cuSymbol("v0_0"),
    ) as EnvF.WriterWithIsAtTopLevel;
    expect(w0_0.writer).toBe(v0_0v);
    expect(env.references.referenceById.get("v0_0")).toEqual([
      {
        referer: [0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      },
    ]);

    const v0_1v = aVar();
    EnvF.set(env, "v0_1", v0_1v);

    // Scope 0-0
    inScope(env, () => {
      const w0_0 = EnvF.referTo(
        env,
        cuSymbol("v0_0"),
      ) as EnvF.WriterWithIsAtTopLevel;
      expect(w0_0.writer).toBe(v0_0v);
      expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
        referer: [0, 0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      });

      const w0_1 = EnvF.referTo(
        env,
        cuSymbol("v0_1"),
      ) as EnvF.WriterWithIsAtTopLevel;
      expect(w0_1.writer).toBe(v0_1v);
      expect(env.references.referenceById.get("v0_1")).toEqual([
        {
          referer: [0, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        },
      ]);

      const v00_0v = aVar();
      EnvF.set(env, "v00_0", v00_0v);

      // Scope 0-0-0
      inScope(env, () => {
        const w0_0 = EnvF.referTo(
          env,
          cuSymbol("v0_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [0, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(
          env,
          cuSymbol("v0_1"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [0, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w00_0 = EnvF.referTo(
          env,
          cuSymbol("v00_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w00_0.writer).toBe(v00_0v);
        expect(env.references.referenceById.get("v00_0")).toEqual([
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
      inScope(env, () => {
        const w0_0 = EnvF.referTo(
          env,
          cuSymbol("v0_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [1, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(
          env,
          cuSymbol("v0_1"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [1, 0, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w00_0 = EnvF.referTo(
          env,
          cuSymbol("v00_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w00_0.writer).toBe(v00_0v);
        expect(env.references.referenceById.get("v00_0")?.at(-1)).toEqual({
          referer: [1, 0, 0],
          referee: {
            scopePath: [0, 0],
            id: "v00_0",
          },
        });
      });
    });

    // Scope 0-1
    inScope(env, () => {
      const w0_0 = EnvF.referTo(
        env,
        cuSymbol("v0_0"),
      ) as EnvF.WriterWithIsAtTopLevel;
      expect(w0_0.writer).toBe(v0_0v);
      expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
        referer: [1, 0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      });

      const w0_1 = EnvF.referTo(
        env,
        cuSymbol("v0_1"),
      ) as EnvF.WriterWithIsAtTopLevel;
      expect(w0_1.writer).toBe(v0_1v);
      expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
        referer: [1, 0],
        referee: {
          scopePath: [0],
          id: "v0_1",
        },
      });

      const v01_0v = aVar();
      EnvF.set(env, "v01_0", v01_0v);

      // Scope 0-1-0
      inScope(env, () => {
        const w0_0 = EnvF.referTo(
          env,
          cuSymbol("v0_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [0, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(
          env,
          cuSymbol("v0_1"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [0, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(
          env,
          cuSymbol("v01_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v01_0v);
        expect(env.references.referenceById.get("v01_0")).toEqual([
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
      inScope(env, () => {
        const w0_0 = EnvF.referTo(
          env,
          cuSymbol("v0_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [1, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(
          env,
          cuSymbol("v0_1"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [1, 1, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(
          env,
          cuSymbol("v01_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v01_0v);
        expect(env.references.referenceById.get("v01_0")?.at(-1)).toEqual({
          referer: [1, 1, 0],
          referee: {
            scopePath: [1, 0],
            id: "v01_0",
          },
        });
      });
    });

    // Scope 0-2
    inScope(env, () => {
      const w0_0 = EnvF.referTo(
        env,
        cuSymbol("v0_0"),
      ) as EnvF.WriterWithIsAtTopLevel;
      expect(w0_0.writer).toBe(v0_0v);
      expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
        referer: [2, 0],
        referee: {
          scopePath: [0],
          id: "v0_0",
        },
      });

      const w0_1 = EnvF.referTo(
        env,
        cuSymbol("v0_1"),
      ) as EnvF.WriterWithIsAtTopLevel;
      expect(w0_1.writer).toBe(v0_1v);
      expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
        referer: [2, 0],
        referee: {
          scopePath: [0],
          id: "v0_1",
        },
      });

      const v02_0v = aVar();
      EnvF.set(env, "v02_0", v02_0v);

      // Scope 0-2-0
      inScope(env, () => {
        const w0_0 = EnvF.referTo(
          env,
          cuSymbol("v0_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [0, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(
          env,
          cuSymbol("v0_1"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [0, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(
          env,
          cuSymbol("v02_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v02_0v);
        expect(env.references.referenceById.get("v02_0")).toEqual([
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
      inScope(env, () => {
        const w0_0 = EnvF.referTo(
          env,
          cuSymbol("v0_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [1, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(
          env,
          cuSymbol("v0_1"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [1, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(
          env,
          cuSymbol("v02_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v02_0v);
        expect(env.references.referenceById.get("v02_0")?.at(-1)).toEqual({
          referer: [1, 2, 0],
          referee: {
            scopePath: [2, 0],
            id: "v02_0",
          },
        });
      });

      // Scope 0-2-2
      inScope(env, () => {
        const w0_0 = EnvF.referTo(
          env,
          cuSymbol("v0_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_0.writer).toBe(v0_0v);
        expect(env.references.referenceById.get("v0_0")?.at(-1)).toEqual({
          referer: [2, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_0",
          },
        });

        const w0_1 = EnvF.referTo(
          env,
          cuSymbol("v0_1"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w0_1.writer).toBe(v0_1v);
        expect(env.references.referenceById.get("v0_1")?.at(-1)).toEqual({
          referer: [2, 2, 0],
          referee: {
            scopePath: [0],
            id: "v0_1",
          },
        });

        const w01_0 = EnvF.referTo(
          env,
          cuSymbol("v02_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w01_0.writer).toBe(v02_0v);
        expect(env.references.referenceById.get("v02_0")?.at(-1)).toEqual({
          referer: [2, 2, 0],
          referee: {
            scopePath: [2, 0],
            id: "v02_0",
          },
        });

        const v022_0v = aVar();
        EnvF.set(env, "v022_0", v022_0v);

        const w022_0 = EnvF.referTo(
          env,
          cuSymbol("v022_0"),
        ) as EnvF.WriterWithIsAtTopLevel;
        expect(w022_0.writer).toBe(v022_0v);
        expect(env.references.referenceById.get("v022_0")?.at(-1)).toEqual({
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
    test("1: the variable is recursively referred", async () => {
      const env = await subjectEnv();

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, cuSymbol("v0"));
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        EnvF.referTo(env, cuSymbol("v0"));
        expect(EnvF.set(env, "v0", aVar())).toEqual(
          new TranspileError(
            "No variable `v0` is defined! NOTE: If you want to define `v0` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );
      });
    });

    test("2: the variable is recursively referred in the inner scope", async () => {
      const env = await subjectEnv();

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, cuSymbol("v0"));
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        inScope(env, () => {
          EnvF.referTo(env, cuSymbol("v0"));
        });
        expect(EnvF.set(env, "v0", aVar())).toEqual(
          new TranspileError(
            "No variable `v0` is defined! NOTE: If you want to define `v0` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );
      });
    });

    test("3: the variable is back-referred", async () => {
      const env = await subjectEnv();

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, cuSymbol("v0"));
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        EnvF.referTo(env, cuSymbol("v1"));
        expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

        expect(EnvF.set(env, "v1", aVar())).toEqual(
          new TranspileError(
            "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );

        inScope(env, () => {
          EnvF.referTo(env, cuSymbol("v1"));
          expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

          expect(EnvF.set(env, "v1", aVar())).toEqual(
            new TranspileError(
              "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
            ),
          );
        });
      });
    });

    test("4: the variable is back-referred in the inner scope", async () => {
      const env = await subjectEnv();

      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, cuSymbol("v0"));
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        inScope(env, () => {
          EnvF.referTo(env, cuSymbol("v1"));
        });
        expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

        expect(EnvF.set(env, "v1", aVar())).toEqual(
          new TranspileError(
            "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
          ),
        );

        inScope(env, () => {
          inScope(env, () => {
            EnvF.referTo(env, cuSymbol("v1"));
          });
          expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

          expect(EnvF.set(env, "v1", aVar())).toEqual(
            new TranspileError(
              "No variable `v1` is defined! NOTE: If you want to define `v1` recursively, wrap the declaration(s) with `recursive`.",
            ),
          );
        });
      });
    });
  });

  test("set returns undefined if the variable is referred to *not* actually as an outer variable", async () => {
    const env = await subjectEnv();

    expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

    EnvF.referTo(env, cuSymbol("v0"));
    expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

    inScope(env, () => {
      expect(EnvF.set(env, "v0", aVar())).toBeUndefined();

      EnvF.referTo(env, cuSymbol("v0"));
      expect(EnvF.set(env, "v1", aVar())).toBeUndefined();

      inScope(env, () => {
        EnvF.referTo(env, cuSymbol("v1"));
      });
      expect(EnvF.set(env, "v2", aVar())).toBeUndefined();
    });
  });
});
