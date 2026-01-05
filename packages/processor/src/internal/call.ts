import * as ContextF from "./context.js";
import {
  type Call,
  type Context,
  type Form,
  TranspileError,
  type Writer,
  functionIdOfCall,
  isMarkedDirectExportableStatementWriter,
  isMarkedDirectStatementWriter,
} from "./types.js";
import { isCuSymbol } from "./types/cu-symbol.js";
import { isList } from "./types/list.js";
import { isPropertyAccess } from "./types/property-access.js";

export function asStatement(
  context: Context,
  form: Form,
): Call | undefined | TranspileError {
  return asCallOf(context, form, isMarkedDirectStatementWriter);
}

export function asExportableStatement(
  context: Context,
  form: Form,
): Call | undefined | TranspileError {
  return asCallOf(context, form, isMarkedDirectExportableStatementWriter);
}

function asCallOf(
  context: Context,
  form: Form,
  p: (w: Writer) => boolean,
): Call | undefined | TranspileError {
  const call = asCall(form);
  if (call === undefined) {
    return;
  }
  const w = ContextF.find(context, functionIdOfCall(call));
  if (TranspileError.is(w)) {
    return w;
  }
  if (!p(w)) {
    return;
  }
  return call;
}

export function asCall(form: Form): Call | undefined {
  if (!isList(form)) {
    return;
  }
  const id = form.values[0];
  if (id === undefined) {
    return;
  }
  if (isCuSymbol(id) || isPropertyAccess(id)) {
    return form as Call;
  }
}
