import * as path from "node:path";

import {
  Scope,
  Env,
  Id,
  isRecursiveConst,
  TranspileError,
  Writer,
  ModulePaths,
  FilePath,
  TranspileOptions,
  transpileOptionsRepl,
  aVar,
} from "./types.js";
import * as References from "./references.js";
import { isDeeperThanOrEqual, isShallowerThan } from "./scope-path.js";
import { expectNever } from "./util/error.js";
import { escapeRegExp } from "./util/regexp.js";

export async function init(
  initial: Scope,
  modulePaths: ModulePaths = new Map(),
  options: TranspileOptions | undefined = undefined,
): Promise<Env> {
  return {
    s: [initial],
    r: References.init(),
    m: modulePaths,
    o: options ?? (await transpileOptionsRepl()),
  };
}

export function find({ s }: Env, id: Id): Writer | undefined {
  for (const frame of s.values()) {
    const result = frame.get(id);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export function referTo({ s, r }: Env, id: Id): Writer | TranspileError {
  for (const [i, frame] of s.entries()) {
    const result = frame.get(id);
    if (result !== undefined) {
      const s = r.p.slice(i);
      References.add(r, { i: id, s });
      return result;
    }
  }
  return new TranspileError(
    `No variable \`${id}\` is defined! NOTE: If you want to define \`${id}\` recursively, wrap the declaration(s) with \`recursive\`.`,
  );
}

export function isDefinedInThisScope({ s }: Env, id: Id): boolean {
  const w = s[0].get(id);
  return w !== undefined && !isRecursiveConst(w);
}

export function set(
  { s, r: { m, p } }: Env,
  id: Id,
  writer: Writer,
): undefined | TranspileError {
  const rs = m.get(id) || [];
  if (
    rs.some((r) => isDeeperThanOrEqual(r.r, p) && isShallowerThan(r.e.s, p))
  ) {
    return new TranspileError(
      `No variable \`${id}\` is defined! NOTE: If you want to define \`${id}\` recursively, wrap the declaration(s) with \`recursive\`.`,
    );
  }
  s[0].set(id, writer);
}

export function push({ s, r }: Env): void {
  References.appendNewScope(r);
  s.unshift(new Map());
}

export function pop({ s, r }: Env): void {
  References.returnToPreviousScope(r);
  // eslint-disable-next-line no-ignore-returned-union/no-ignore-returned-union
  s.shift();
}

export function findModule(
  env: Env,
  id: Id,
): FilePath | undefined | TranspileError {
  const {
    m,
    o: { mode, src, srcPath },
  } = env;
  const modPath = m.get(id);
  if (modPath === undefined) {
    return;
  }

  // If src is a directory, srcPath should be the absolute path to cwd.
  const currentFileDir = src.isDirectory() ? srcPath : path.dirname(srcPath);
  const modFullPath = path.resolve(currentFileDir, modPath);

  const r = set(env, id, aVar());
  if (r instanceof TranspileError) {
    return r;
  }

  switch (mode) {
    case "repl":
      return `file://${modFullPath}`;
    case "module":
      const relativeModPath = path.relative(
        path.resolve(currentFileDir),
        modFullPath,
      );
      return path.sep === "/"
        ? relativeModPath
        : relativeModPath.replace(new RegExp(escapeRegExp(path.sep), "g"), "/");
    default:
      expectNever(mode);
  }
}

export function forRepl(env: Env, caller: string): Env {
  if (env.o.mode === "module") {
    console.warn(
      `${caller}: TranspileOptions.mode "module" is invalid for \`${caller}\`. Replaced with "repl".`,
    );
  }
  return { ...env, o: { ...env.o, mode: "repl", awaitingId: undefined } };
}

export function isAtTopLevel({ s }: Env): boolean {
  return s.length <= 1;
}
