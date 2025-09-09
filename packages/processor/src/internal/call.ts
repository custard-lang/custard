import * as ContextF from "./context.js";
import {
  type Call,
  type Context,
  type Form,
  type Writer,
  functionIdOfCall,
  isMarkedDirectExportableStatementWriter,
  isMarkedDirectStatementWriter,
} from "./types.js";
import { isCuSymbol } from "./types/cu-symbol.js";
import { isList } from "./types/list.js";
import { isPropertyAccess } from "./types/property-access.js";

export function isStatement(context: Context, form: Form): form is Call {
  return isCallOf(context, form, isMarkedDirectStatementWriter);
}

export function isExportableStatement(
  context: Context,
  form: Form,
): form is Call {
  return isCallOf(context, form, isMarkedDirectExportableStatementWriter);
}

function isCallOf(
  context: Context,
  form: Form,
  p: (w: Writer) => boolean,
): form is Call {
  const call = asCall(form);
  if (call === undefined) {
    return false;
  }
  const w = ContextF.find(context, functionIdOfCall(call));
  // TODO: More helpful error if the writer is not found
  return w !== undefined && p(w);
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
