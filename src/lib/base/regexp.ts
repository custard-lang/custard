/* eslint-disable @typescript-eslint/unbound-method */

// Q. Why is this file named "regExp.ts"?
// A. All standard library modules' names are camelCase of the corresponding JavaScript class. And JavaScript's "RegExp" is "Exp" starts with the upper "E".
export const test = Function.call.bind(RegExp.prototype.test);
