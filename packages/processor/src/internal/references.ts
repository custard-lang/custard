import { append, clone, goUp } from "./scope-path.js";
import { ReferencePath, References } from "./types.js";

export function init(): References {
  return {
    referenceById: new Map(),
    currentScope: [0],
    nextScope: 0,
  };
}

export function add(
  { referenceById, currentScope }: References,
  to: ReferencePath,
): void {
  const refs = referenceById.get(to.id) ?? [];
  refs.push({ referer: clone(currentScope), referee: to });
  referenceById.set(to.id, refs);
}

export function appendNewScope(referer: References): void {
  append(referer.currentScope, referer.nextScope);
  referer.nextScope = 0;
}

export function returnToPreviousScope(referer: References): void {
  const lastI = goUp(referer.currentScope);
  if (lastI === undefined) {
    throw new Error(
      `Assertion Failure: No scope to return! referer: ${JSON.stringify(
        referer,
      )}`,
    );
  }
  referer.nextScope = lastI + 1;
}
