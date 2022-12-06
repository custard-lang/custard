import type { ScopeIndex, ScopePath } from './types.js';

function isPrefixOf(path0: ScopePath, path1: ScopePath): boolean {
  // ScopePath is ordered by deeper to shallower.
  // So compare each ScopeIndex from the last element of them.
  const [longer, shorter] =
    path0.length > path1.length ? [path0, path1] : [path1, path0];

  for (let offset = 1; offset <= shorter.length; ++offset) {
    if (longer[longer.length - offset] !== shorter[shorter.length - offset]) {
      return false;
    }
  }
  return true;
}

export function isDeeperThanOrEqual(path0: ScopePath, path1: ScopePath): boolean {
  return  path0.length >= path1.length && isPrefixOf(path1, path0);
}

export function isShallowerThan(path0: ScopePath, path1: ScopePath): boolean {
  return  path0.length < path1.length && isPrefixOf(path0, path1);
}

export function clone(path: ScopePath): ScopePath {
  return [...path];
}

export function append(path: ScopePath, piece: ScopeIndex): void {
  path.unshift(piece);
}

export function goUp(path: ScopePath): ScopeIndex | undefined {
  return path.shift();
}
