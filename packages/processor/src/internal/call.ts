import * as EnvF from "./env.js";
import {
  type Call,
  type Env,
  type Form,
  type Writer,
  functionIdOfCall,
  isMarkedDirectExportableStatementWriter,
  isMarkedDirectStatementWriter,
} from "./types.js";
import { isCuSymbol } from "./types/cu-symbol.js";
import { isList } from "./types/list.js";
import { isPropertyAccess } from "./types/property-access.js";

export function isStatement(env: Env, form: Form): form is Call {
  return isCallOf(env, form, isMarkedDirectStatementWriter);
}

export function isExportableStatement(env: Env, form: Form): form is Call {
  return isCallOf(env, form, isMarkedDirectExportableStatementWriter);
}

function isCallOf(
  env: Env,
  form: Form,
  p: (w: Writer) => boolean,
): form is Call {
  const call = asCall(form);
  if (call === undefined) {
    return false;
  }
  const w = EnvF.find(env, functionIdOfCall(call));
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
