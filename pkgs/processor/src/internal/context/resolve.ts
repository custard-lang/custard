import {
  type Writer,
  isNamespace,
  isWriter,
  isProvidedConst,
  type SymbolResolutionResult,
  PropertyAccessResolutionResult,
  PropertyAccessResolutionResultOnlyId,
  PropertyAccessResolutionResultDynamic,
} from "../types.js";
import {
  TranspileError,
  type Id,
  type PropertyAccess,
  type CuSymbol,
  isCuSymbol,
  isPropertyAccess,
  aConst,
  type Context,
} from "../../types.js";
import * as References from "../references.js";
import * as ScopeF from "../scope.js";
import { TOP_LEVEL_OFFSET } from "./core.js";

export function find(
  context: Context,
  symLike: CuSymbol | PropertyAccess<unknown>,
): Writer | undefined | TranspileError {
  const r = resolve(context, symLike);
  if (TranspileError.is(r)) {
    return r;
  }
  return r.writer;
}

function resolve(
  context: Context,
  symLike: CuSymbol | PropertyAccess<unknown>,
): SymbolResolutionResult | PropertyAccessResolutionResult | TranspileError {
  if (isCuSymbol(symLike)) {
    return resolveCuSymbol(context, symLike);
  }
  return resolvePropertyAccess(context, symLike);
}

export function resolveCuSymbol(
  context: Context,
  sym: CuSymbol,
): SymbolResolutionResult | TranspileError {
  return resolveCuSymbolCore(context, sym, false);
}

export function resolvePropertyAccess(
  context: Context,
  pa: PropertyAccess<unknown>,
): PropertyAccessResolutionResult | TranspileError {
  return resolvePropertyAccessCore(context, pa, false);
}

export function referToCuSymbol(
  context: Context,
  sym: CuSymbol,
): SymbolResolutionResult | TranspileError {
  return resolveCuSymbolCore(context, sym, true);
}

export function referToPropertyAccess(
  context: Context,
  pa: PropertyAccess<unknown>,
): PropertyAccessResolutionResult | TranspileError {
  return resolvePropertyAccessCore(context, pa, true);
}

function resolveCuSymbolCore(
  context: Context,
  sym: CuSymbol,
  doRefer: boolean,
): SymbolResolutionResult | TranspileError {
  return resolveIdCore(context, sym.value, doRefer);
}

function resolvePropertyAccessCore(
  context: Context,
  pa: PropertyAccess<unknown>,
  doRefer: boolean,
): PropertyAccessResolutionResult | TranspileError {
  const spar = splitPropertyAccess(pa);
  if (spar.hasNonId) {
    return spar;
  }
  const [id0, ...ids] = spar.ids;
  const srr = resolveIdCore(context, id0, doRefer);
  if (TranspileError.is(srr)) {
    return srr;
  }
  if (!isNamespace(srr.writer)) {
    return {
      ...spar,
      ...srr,
    };
  }

  let module = srr.writer;
  let lastW: Writer = srr.writer;
  const { canBeAtPseudoTopLevel } = srr;
  for (const [i, part] of ids.entries()) {
    const subW = module[part];
    if (subW == null) {
      return new TranspileError(
        `\`${part}\` is not defined in \`${ids.slice(0, i - 1).join(".")}\`!`,
      );
    }
    if (isWriter(subW)) {
      if (isNamespace(subW)) {
        module = subW;
        lastW = subW;
        continue;
      }
      return { ...spar, writer: subW, canBeAtPseudoTopLevel };
    }
    return { ...spar, writer: aConst(), canBeAtPseudoTopLevel };
  }
  return { ...spar, writer: lastW, canBeAtPseudoTopLevel };
}

function resolveIdCore(
  { scopes, references }: Context,
  id: Id,
  doRefer: boolean,
): SymbolResolutionResult | TranspileError {
  const topLevelI = scopes.length - TOP_LEVEL_OFFSET;
  for (const [i, frame] of scopes.entries()) {
    const writer = ScopeF.get(frame, id);
    if (writer !== undefined) {
      if (doRefer) {
        const scopePath = references.currentScope.slice(i);
        References.add(references, { id, scopePath });
      }
      return {
        writer,
        canBeAtPseudoTopLevel: i === topLevelI && !isProvidedConst(writer),
      };
    }
  }
  return new TranspileError(
    `No variable \`${id}\` is defined! NOTE: If you want to define \`${id}\` recursively, wrap the declaration(s) with \`recursive\`.`,
  );
}

type SplitPropertyAccessResult =
  | Pick<PropertyAccessResolutionResultOnlyId, "hasNonId" | "ids">
  | PropertyAccessResolutionResultDynamic;

function splitPropertyAccess(
  pa: PropertyAccess<unknown>,
): SplitPropertyAccessResult {
  const result: [Id, ...Id[]] = [pa.right];
  let current = pa.left;
  while (isPropertyAccess(current)) {
    result.unshift(current.right);
    current = current.left;
  }
  if (isCuSymbol(current)) {
    result.unshift(current.value);
    return { hasNonId: false, ids: result };
  }
  return { hasNonId: true, ids: result, nonId: current };
}
