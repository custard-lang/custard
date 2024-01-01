/* eslint-disable @typescript-eslint/unbound-method */

import { constructorFor } from "../common.js";

// Q. Why is this file named "regExp.ts"?
// A. All standard library modules' names are camelCase of the corresponding JavaScript class. And JavaScript's "RegExp" is "Exp" starts with the upper "E".

export const _cu$new = constructorFor("RegExp", 2);

export const test = Function.call.bind(RegExp.prototype.test);
