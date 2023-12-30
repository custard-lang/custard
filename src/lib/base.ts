export * from "./base/safe.js";
export * from "./base/iteration/unbounded.js";
import * as arrayModule from "./base/array.js";
import * as stringModule from "./base/string.js";
import * as regexpModule from "./base/regExp.js";

import { asNamespace } from "../definitions.js";

export const array = asNamespace(arrayModule, "./base/array.js");

export const string = asNamespace(stringModule, "./base/string.js");

export const regExp = asNamespace(regexpModule, "./base/regExp.js");
