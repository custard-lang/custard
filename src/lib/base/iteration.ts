import {
  Env,
  Form,
  Id,
  JsSrc,
  markAsDirectWriter,
  MarkedDirectWriter,
  TranspileError,
} from "../../internal/types.js";

export const _cu$break = transpilingControlStatement("break");
export const _cu$continue = transpilingControlStatement("continue");

function transpilingControlStatement(id: Id): MarkedDirectWriter {
  return markAsDirectWriter(
    (_env: Env, ...rest: Form[]): JsSrc | TranspileError => {
      if (rest.length > 0) {
        return new TranspileError(`\`${id}\` doesn't accept any arguments!`);
      }
      return id;
    },
  );
}
