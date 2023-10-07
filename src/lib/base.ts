export * from "./base/safe.js";
export * from "./base/iteration/unbounded.js";
import * as arrayModule from "./base/array.js";

import { asNamespace } from "../definitions.js";

export const array = asNamespace(arrayModule, "./base/array.js");
