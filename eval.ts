import { Form, Float64 } from "./types";

export const initialEnv = {
  addF: (a: Form, b: Form): Form => (a as Float64) + (b as Float64),
  subF: (a: Form, b: Form): Form => (a as Float64) - (b as Float64),
  mulF: (a: Form, b: Form): Form => (a as Float64) * (b as Float64),
  divF: (a: Form, b: Form): Form => (a as Float64) / (b as Float64),
};
