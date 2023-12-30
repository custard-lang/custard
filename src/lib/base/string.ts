/* eslint-disable @typescript-eslint/unbound-method */

export const includes = Function.call.bind(String.prototype.includes);
export const replace = Function.call.bind(String.prototype.replace);
export const repeat = Function.call.bind(String.prototype.repeat);
export const split = Function.call.bind(String.prototype.split);
export const startsWith = Function.call.bind(String.prototype.startsWith);
export const trim = Function.call.bind(String.prototype.trim);
