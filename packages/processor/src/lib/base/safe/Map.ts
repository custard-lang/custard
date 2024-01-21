/* eslint-disable @typescript-eslint/unbound-method */

import { constructorFor } from "../common.js";

export const _cu$new = constructorFor("Map", 2);

export const entries = Function.call.bind(Map.prototype.entries);
export const get = Function.call.bind(Map.prototype.get);
export const set = Function.call.bind(Map.prototype.set);
