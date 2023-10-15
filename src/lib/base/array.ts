import type { JsSrc } from "../../types.js";
import { transpiling1 } from "./common.js";

export const first = transpiling1("first", (a: JsSrc) => `${a}[0]`);

// TODO: If a.at(-1) is not faster, implement a[a.length] as macro after
//       implementing more flexible tmpVar generator.
export const last = transpiling1("last", (a: JsSrc) => `${a}.at(-1)`);

export const map = Function.call.bind(Array.prototype.map);
export const push = Function.call.bind(Array.prototype.push);
