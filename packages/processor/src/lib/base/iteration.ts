import {
  type Env,
  type Form,
  type Id,
  type JsSrc,
  ktvalOther,
  type Ktvals,
  markAsDirectWriter,
  TranspileError,
} from "../../types.js";
import {
  type MarkedDirectWriter,
  ordinaryStatement,
} from "../../internal/types.js";

export const _cu$break = transpilingControlStatement("break");
export const _cu$continue = transpilingControlStatement("continue");

function transpilingControlStatement(id: Id): MarkedDirectWriter {
  return markAsDirectWriter(
    (_env: Env, ...rest: Form[]): Ktvals<JsSrc> | TranspileError => {
      if (rest.length > 0) {
        // TODO: Support label
        return new TranspileError(`\`${id}\` doesn't accept any arguments!`);
      }
      return [ktvalOther(`${id} `)];
    },
    ordinaryStatement,
  );
}
