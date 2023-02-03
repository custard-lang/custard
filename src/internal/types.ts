import type { Stats } from "node:fs";

import type { Id, ModulePaths, Scope, TranspileOptions } from "../types.js";

export type Env<State = TranspileState> = {
  readonly scopes: [Scope, ...Scope[]];
  readonly references: References; // References in the Progaram
  readonly modules: ModulePaths; // Mapping from module name to its path.
  readonly transpileState: State;
};

export type References = {
  readonly referenceById: Map<Id, Ref[]>;
  readonly currentScope: ScopePath;
  nextScope: ScopeIndex;
};

export type TranspileState = TranspileRepl | TranspileModule;

export type TranspileRepl = TranspileOptions & {
  mode: "repl";
  src: Stats;
  topLevelValues: Map<Id, any>;
  awaitingId: Id | undefined;
};

export type TranspileModule = TranspileOptions & {
  mode: "module";
  src: Stats;
};

export type Ref = {
  readonly referer: ScopePath;
  readonly referee: ReferencePath;
};

export type ReferencePath = {
  scopePath: ScopePath; // Index of the every scope
  id: Id; // The variable name
};

export type ScopeIndex = number;

export type ScopePath = ScopeIndex[];
