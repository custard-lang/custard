import { Env, Form } from "./types";

export const initialEnv: Env = new Map();

initialEnv.set("addF", (a: Form, b: Form) => `(${a} + ${b})`);
initialEnv.set("subF", (a: Form, b: Form) => `(${a} - ${b})`);
initialEnv.set("mulF", (a: Form, b: Form) => `(${a} * ${b})`);
initialEnv.set("divF", (a: Form, b: Form) => `(${a} / ${b})`);

export function evalAst(ast: Form, env: Env): any {
  const go = (ast_: Form, result: string): string => {
    if (ast_ instanceof Array) {
      // TODO
      return "";
    }
    switch (typeof ast_) {
      case "string":
        return `${result}${JSON.stringify(ast_)}`;
      case "undefined":
      case "number":
      case "boolean":
        return `${result}${ast_}`;
      case "object":
        switch (ast_.t) {
          case "Symbol":
            return `${result}${JSON.stringify(ast_.v)}`;
          case "Integer32":
            return `${result}${ast_.v}`;
        }
    }
  };
  return eval(go(ast, ""));
}
