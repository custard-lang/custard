import type { Id } from "./id.js";

// The only intermediate language of Custard so far.
// Named after "Keep Toplevel values across eVALuations".
export type Ktval<Target> =
  | KtvalRefer
  | KtvalAssign<Target>
  | KtvalFunctionPostlude<Target>
  | KtvalImport
  | KtvalImportStartAs
  | KtvalExport
  | KtvalOther<Target>;

export type Ktvals<Target> = Array<Ktval<Target>>;

export const KtvalReferT = 1;

export interface KtvalRefer {
  t: typeof KtvalReferT;
  id: Id;
}

export function ktvalRefer(id: Id): KtvalRefer {
  return { t: KtvalReferT, id };
}

export const KtvalAssignT = 2;

export type KtvalAssign<Target> =
  | KtvalAssignSimple<Target>
  | KtvalAssignDestructuringArray<Target>
  | KtvalAssignDestructuringObject<Target>;

export const KtvalAssignDeclConst = "const ";
export const KtvalAssignDeclLet = "let ";
export const KtvalAssignDeclNone = "";
export type KtvalAssignDecl =
  | typeof KtvalAssignDeclConst
  | typeof KtvalAssignDeclLet
  | typeof KtvalAssignDeclNone;

export const KtvalAssignSimpleT = 0;

export interface KtvalAssignSimple<Target> extends KtvalAssignCore<Target> {
  at: typeof KtvalAssignSimpleT;
  assignee: Id;
}

export const KtvalAssignDestructuringArrayT = 1;

export interface KtvalAssignDestructuringArray<Target>
  extends KtvalAssignCore<Target> {
  at: typeof KtvalAssignDestructuringArrayT;
  assignee: Id[];
}

export const KtvalAssignDestructuringObjectT = 2;

export interface KtvalAssignDestructuringObject<Target>
  extends KtvalAssignCore<Target> {
  at: typeof KtvalAssignDestructuringObjectT;
  assignee: Array<[Ktvals<Target> | Id, Id] | Id>;
}

export function ktvalAssignSimple<Target>(
  decl: KtvalAssignDecl,
  assignee: Id,
  exp: Ktvals<Target>,
): KtvalAssignSimple<Target> {
  return { t: KtvalAssignT, at: KtvalAssignSimpleT, decl, assignee, exp };
}

export function ktvalAssignDestructuringArray<Target>(
  decl: KtvalAssignDecl,
  assignee: Id[],
  exp: Ktvals<Target>,
): KtvalAssignDestructuringArray<Target> {
  return {
    t: KtvalAssignT,
    at: KtvalAssignDestructuringArrayT,
    decl,
    assignee,
    exp,
  };
}

export function ktvalAssignDestructuringObject<Target>(
  decl: KtvalAssignDecl,
  assignee: Array<[Ktvals<Target>, Id] | Id>,
  exp: Ktvals<Target>,
): KtvalAssignDestructuringObject<Target> {
  return {
    t: KtvalAssignT,
    at: KtvalAssignDestructuringObjectT,
    decl,
    assignee,
    exp,
  };
}

export interface KtvalAssignCore<Target> {
  t: typeof KtvalAssignT;
  decl: KtvalAssignDecl;
  exp: Ktvals<Target>;
}

export const KtvalFunctionPostludeT = 3;

export interface KtvalFunctionPostlude<Target> {
  t: typeof KtvalFunctionPostludeT;
  id: Id;
  body: Ktvals<Target>;
}

export function ktvalFunctionPostlude<Target>(
  id: Id,
  body: Ktvals<Target>,
): KtvalFunctionPostlude<Target> {
  return { t: KtvalFunctionPostludeT, id, body };
}

export const KtvalImportT = 4;

export interface KtvalImport {
  t: typeof KtvalImportT;
  specifierForRepl: string;
  specifierForModule: string;
  ids: Id[];
}

export function ktvalImport(
  specifierForRepl: string,
  specifierForModule: string,
  ids: Id[],
): KtvalImport {
  return { t: KtvalImportT, specifierForRepl, specifierForModule, ids };
}

export const KtvalImportStartAsT = 5;

export interface KtvalImportStartAs {
  t: typeof KtvalImportStartAsT;
  specifierForRepl: string;
  specifierForModule: string;
  id: Id;
}

export function ktvalImportStartAs(
  specifierForRepl: string,
  specifierForModule: string,
  id: Id,
): KtvalImportStartAs {
  return { t: KtvalImportStartAsT, specifierForRepl, specifierForModule, id };
}

export const KtvalExportT = 6;

export interface KtvalExport {
  t: typeof KtvalExportT;
}

export function ktvalExport(): KtvalExport {
  return { t: KtvalExportT };
}

export const KtvalOtherT = 0;

export interface KtvalOther<Target> {
  t: typeof KtvalOtherT;
  exp: Target;
}

export function ktvalOther<Target>(exp: Target): KtvalOther<Target> {
  return { t: KtvalOtherT, exp };
}
