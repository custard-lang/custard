import { Scope } from "../../types";

export function module(): Scope {
  const b: Scope = new Map();

  // TODO:指定した名前を使えるようにしつつ、対応するライブラリーを解決
  b.set("import");

  return b;
}
