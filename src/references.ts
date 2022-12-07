import { append, clone, goUp } from "./scope-path.js";
import { ReferencePath, References } from "./types.js";

export function init(): References {
  return {
    m: new Map(),
    p: [0],
    n: 0,
  };
}

/*

For testing:

const { init, appendNewScope, returnToPreviousScope } = await import('./dist/src/references.js');
const rs = init()

appendNewScope(rs); rs // - 0:
appendNewScope(rs); rs //     - 0:
appendNewScope(rs); rs //         - 0:
appendNewScope(rs); rs //             - 0:
appendNewScope(rs); rs //                 - 0:
                                          returnToPreviousScope(rs); rs
appendNewScope(rs); rs //                 - 1:
                                          returnToPreviousScope(rs); rs
                                      returnToPreviousScope(rs); rs
appendNewScope(rs); rs //             - 1:
appendNewScope(rs); rs //                 - 0:
                                          returnToPreviousScope(rs); rs
                                      returnToPreviousScope(rs); rs
                                  returnToPreviousScope(rs); rs
                              returnToPreviousScope(rs); rs
                          returnToPreviousScope(rs); rs
appendNewScope(rs); rs // - 1
appendNewScope(rs); rs //     - 0
                              returnToPreviousScope(rs); rs
                          returnToPreviousScope(rs); rs
appendNewScope(rs); rs // - 2
                          returnToPreviousScope(rs); rs
appendNewScope(rs); rs // - 3
appendNewScope(rs); rs //     - 0
appendNewScope(rs); rs //         - 0
                                  returnToPreviousScope(rs); rs
                              returnToPreviousScope(rs); rs
                          returnToPreviousScope(rs); rs
appendNewScope(rs); rs // - 4
appendNewScope(rs); rs //     - 0
appendNewScope(rs); rs //         - 0
                                  returnToPreviousScope(rs); rs
appendNewScope(rs); rs //         - 1
                                  returnToPreviousScope(rs); rs
                              returnToPreviousScope(rs); rs
appendNewScope(rs); rs //     - 1
appendNewScope(rs); rs //         - 0
*/

export function add({ m, p }: References, to: ReferencePath): void {
  const refs = m.get(to.i) ?? [];
  refs.push({ r: clone(p), e: to });
  m.set(to.i, refs);
}

export function appendNewScope(r: References): void {
  append(r.p, r.n);
  r.n = 0;
}

export function returnToPreviousScope(r: References): void {
  const lastI = goUp(r.p);
  if (lastI === undefined) {
    throw new Error(
      `Assertion Failure: No scope to return! r: ${JSON.stringify(r)}`,
    );
  }
  r.n = lastI + 1;
}
