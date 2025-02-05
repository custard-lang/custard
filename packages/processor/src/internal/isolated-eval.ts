// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

import { ExpectNever } from "../util/error.js";
import { importModuleFromJsSrc } from "../util/eval.js";

import { CU_ENV } from "./cu-env.js";
import { tmpVarOf } from "./env.js";
import {
  type Env,
  type JsSrc,
  type Ktvals,
  KtvalReferT,
  KtvalAssignT,
  KtvalOtherT,
  KtvalImportT,
  KtvalImportStartAsT,
  KtvalExportT,
  KtvalFunctionPostludeT,
  ktvalOther,
  KtvalAssignDestructuringArrayT,
  KtvalAssignSimpleT,
  KtvalAssignDestructuringObjectT,
  type KtvalAssign,
  type TranspileModule,
} from "./types.js";

// TODO: Rename with this file. I was worried that the function itself can be referred
//       (and rewritten) by the user code because I used `eval` to implement
//       this for the first time.
export async function _cu$eval(
  body: Ktvals<JsSrc>,
  lastExpression: Ktvals<JsSrc>,
  env: Env,
): Promise<any> {
  // https://gist.github.com/tomhodgins/0e5a98610a1da2a98049614a4f170734
  let f = `export default async (${CU_ENV})=>{${transpileKtvalsForEval(body, env)}`;
  if (lastExpression.length > 0) {
    f = `${f}return ${transpileKtvalsForEval(lastExpression, env)}`;
  }
  f = `${f}}`;

  // TODO: Write to a file executable by the dedicated custard's subcommand.
  // console.log(`${f}\n//------------------`);

  const mod = await importModuleFromJsSrc(f);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/return-await
  return await mod.default(env);
}

export function transpileKtvalsForEval(ktvals: Ktvals<JsSrc>, env: Env): JsSrc {
  return ktvals
    .map((ktval) => {
      switch (ktval.t) {
        case KtvalReferT: {
          const idJson = JSON.stringify(ktval.id);
          return `_cu$env.transpileState.topLevelValues.get(${idJson})`;
        }

        case KtvalAssignT: {
          switch (ktval.at) {
            case KtvalAssignSimpleT: {
              const idJson = JSON.stringify(ktval.assignee);
              const expSrc = transpileKtvalsForEval(ktval.exp, env);
              return `void _cu$env.transpileState.topLevelValues.set(${idJson},${expSrc});\n`;
            }

            case KtvalAssignDestructuringArrayT: {
              const { statement, id: tmpId } = tmpVarOf(env, ktval.exp);
              const setsSrc = ktval.assignee
                .map((id, i) => {
                  const idJson = JSON.stringify(id);
                  return `void _cu$env.transpileState.topLevelValues.set(${idJson},${tmpId}[${i}]);\n`;
                })
                .join("");
              return `${transpileKtvalsForEval(statement, env)}${setsSrc}`;
            }

            case KtvalAssignDestructuringObjectT: {
              const { statement, id: tmpId } = tmpVarOf(env, ktval.exp);
              const setsSrc = ktval.assignee
                .map((keyValue) => {
                  if (typeof keyValue === "string") {
                    const valueJson = JSON.stringify(keyValue);
                    return `void _cu$env.transpileState.topLevelValues.set(${valueJson},${tmpId}.${keyValue});\n`;
                  }
                  const [key, value] = keyValue;
                  const valueJson = JSON.stringify(value);
                  const keySrc =
                    typeof key === "string"
                      ? `.${key}`
                      : transpileKtvalsForEval(key, env);
                  return `void _cu$env.transpileState.topLevelValues.set(${valueJson},${tmpId}${keySrc});\n`;
                })
                .join("");
              return `${transpileKtvalsForEval(statement, env)}${setsSrc}`;
            }

            default:
              throw ExpectNever(ktval);
          }
        }

        case KtvalFunctionPostludeT: {
          const functionSrc = `${transpileKtvalsForEval(ktval.body, env)}}`;
          const idJson = JSON.stringify(ktval.id);
          const set = `void _cu$env.transpileState.topLevelValues.set(${idJson},${functionSrc})`;
          const get = `_cu$env.transpileState.topLevelValues.get(${idJson})`;
          return `(() => {\n${set}\nreturn ${get}\n})()`;
        }

        case KtvalImportT: {
          const specifierJson = JSON.stringify(ktval.specifierForRepl);
          const awaitImport = ktvalOther(`await import(${specifierJson})`);
          const { statement, id: tmpId } = tmpVarOf(env, [awaitImport]);
          const importsSrc = ktval.ids
            .map((id) => {
              const idJson = JSON.stringify(id);
              return `_cu$env.transpileState.topLevelValues.set(${idJson},${tmpId}.${id});\n`;
            })
            .join("");
          return `${transpileKtvalsForEval(statement, env)}${importsSrc}`;
        }

        case KtvalImportStartAsT: {
          const idJson = JSON.stringify(ktval.id);
          const specifierJson = JSON.stringify(ktval.specifierForRepl);
          return `_cu$env.transpileState.topLevelValues.set(${idJson},await import(${specifierJson}));\n`;
        }

        case KtvalExportT:
          return "";

        case KtvalOtherT:
          return ktval.exp;

        default:
          throw ExpectNever(ktval);
      }
    })
    .join("");
}

export function transpileKtvalsForModule(
  ktvals: Ktvals<JsSrc>,
  env: Env<TranspileModule>,
): JsSrc {
  return ktvals
    .map((ktval) => {
      switch (ktval.t) {
        case KtvalReferT:
          return ktval.id;

        case KtvalAssignT: {
          const expSrc = transpileKtvalsForModule(ktval.exp, env);
          return `${ktval.decl}${toJsAssignee(ktval, env)}=${expSrc};\n`;
        }

        case KtvalFunctionPostludeT: {
          return `${transpileKtvalsForModule(ktval.body, env)}}`;
        }

        case KtvalImportT: {
          const specifier = JSON.stringify(ktval.specifierForModule);
          return `import{${ktval.ids.join(", ")}}from${specifier};\n`;
        }

        case KtvalImportStartAsT: {
          const specifier = JSON.stringify(ktval.specifierForModule);
          return `import * as ${ktval.id} from ${specifier};\n`;
        }

        case KtvalExportT:
          return "export ";

        case KtvalOtherT:
          return ktval.exp;
        default:
          throw ExpectNever(ktval);
      }
    })
    .join("");
}

function toJsAssignee(
  ktval: KtvalAssign<JsSrc>,
  env: Env<TranspileModule>,
): JsSrc {
  switch (ktval.at) {
    case KtvalAssignSimpleT:
      return ktval.assignee;
    case KtvalAssignDestructuringArrayT:
      return `[${ktval.assignee.join(",")}]`;
    case KtvalAssignDestructuringObjectT:
      return `{${ktval.assignee
        .map((keyValue) => {
          if (Array.isArray(keyValue)) {
            const [key, value] = keyValue;
            if (typeof key === "string") {
              return `${key}:${value}`;
            }
            return `${transpileKtvalsForModule(key, env)}:${value}`;
          }
          return keyValue;
        })
        .join(",")}}`;
    default:
      throw ExpectNever(ktval);
  }
}
