import { merge } from "../scope.js";
import { safe } from "./base/safe.js";
import { module } from "./base/module.js";
import { unbounded } from "./base/iteration/unbounded.js";

export const base = () => merge(safe, unbounded, module);
