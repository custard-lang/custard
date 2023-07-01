import { jsModuleOfBody } from "../../internal/transpile.js";
import {
  Env,
  Form,
  Id,
  JsModule,
  markAsDirectWriter,
  MarkedDirectWriter,
  TranspileError,
} from "../../internal/types.js";

export const _cu$break = transpilingControlStatement("break");
export const _cu$continue = transpilingControlStatement("continue");

function transpilingControlStatement(id: Id): MarkedDirectWriter {
  return markAsDirectWriter(
    (_env: Env, ...rest: Form[]): JsModule | TranspileError => {
      if (rest.length > 0) {
        // TODO: Support label
        return new TranspileError(`\`${id}\` doesn't accept any arguments!`);
      }
      return jsModuleOfBody(id);
    },
  );
}
