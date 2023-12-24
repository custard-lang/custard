import type { JsSrc } from "../../types.js";
import { transpiling1, transpiling2 } from "./common.js";

/* eslint-disable @typescript-eslint/unbound-method */

export const at = transpiling2(
  "array.at",
  (a: JsSrc, b: JsSrc) => `${a}[${b}]`,
);

export const first = transpiling1("array.first", (a: JsSrc) => `${a}[0]`);

// TODO: If a.at(-1) is not faster, implement a[a.length] as macro after
//       implementing more flexible tmpVar generator.
export const last = transpiling1("array.last", (a: JsSrc) => `${a}.at(-1)`);

export const map = Function.call.bind(Array.prototype.map);
export const push = Function.call.bind(Array.prototype.push);
export const reduce = Function.call.bind(Array.prototype.reduce);
export const slice = Function.call.bind(Array.prototype.slice);
