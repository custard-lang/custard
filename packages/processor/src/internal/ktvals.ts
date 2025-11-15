import {
  type KtvalAssign,
  KtvalAssignDestructuringArrayT,
  KtvalAssignDestructuringObjectT,
  KtvalAssignSimpleT,
  KtvalAssignT,
  KtvalExportT,
  KtvalFunctionPostludeT,
  KtvalImportStarAsT,
  KtvalImportT,
  ktvalOther,
  KtvalOtherT,
  KtvalReferT,
  type Ktvals,
} from "./types/ktval.js";
import type { Context, JsSrc, TranspileModule } from "./types.js";
import { importModuleFromJsSrc } from "../util/eval.js";
import { tmpVarOf } from "./context.js";
import { ExpectNever } from "../util/error.js";

// This module is inherently unsafe!
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function evalKtvals(
  body: Ktvals<JsSrc>,
  lastExpression: Ktvals<JsSrc>,
  context: Context,
): Promise<any> {
  // https://gist.github.com/tomhodgins/0e5a98610a1da2a98049614a4f170734
  let f = `export default async (_cu$c)=>{${transpileKtvalsForEval(body, context)}`;
  if (lastExpression.length > 0) {
    f = `${f}return ${transpileKtvalsForEval(lastExpression, context)}`;
  }
  f = `${f}}`;

  // TODO: Write to a file executable by the dedicated custard's subcommand.
  // console.log(`${f}\n//------------------`);

  const mod = await importModuleFromJsSrc(f);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return await mod.default(context);
}

export function transpileKtvalsForEval(
  ktvals: Ktvals<JsSrc>,
  context: Context,
): JsSrc {
  return ktvals
    .map((ktval) => {
      switch (ktval.t) {
        case KtvalReferT: {
          const idJson = JSON.stringify(ktval.id);
          return `_cu$c.transpileState.topLevelValues.get(${idJson})`;
        }

        case KtvalAssignT: {
          switch (ktval.at) {
            case KtvalAssignSimpleT: {
              const idJson = JSON.stringify(ktval.assignee);
              const expSrc = transpileKtvalsForEval(ktval.exp, context);
              return `void _cu$c.transpileState.topLevelValues.set(${idJson},${expSrc});\n`;
            }

            case KtvalAssignDestructuringArrayT: {
              const { statement, id: tmpId } = tmpVarOf(context, ktval.exp);
              const setsSrc = ktval.assignee
                .map((id, i) => {
                  const idJson = JSON.stringify(id);
                  return `void _cu$c.transpileState.topLevelValues.set(${idJson},${tmpId}[${i}]);\n`;
                })
                .join("");
              return `${transpileKtvalsForEval(statement, context)}${setsSrc}`;
            }

            case KtvalAssignDestructuringObjectT: {
              const { statement, id: tmpId } = tmpVarOf(context, ktval.exp);
              const setsSrc = ktval.assignee
                .map((keyValue) => {
                  if (typeof keyValue === "string") {
                    const valueJson = JSON.stringify(keyValue);
                    return `void _cu$c.transpileState.topLevelValues.set(${valueJson},${tmpId}.${keyValue});\n`;
                  }
                  const [key, value] = keyValue;
                  const valueJson = JSON.stringify(value);
                  const keySrc =
                    typeof key === "string"
                      ? `.${key}`
                      : transpileKtvalsForEval(key, context);
                  return `void _cu$c.transpileState.topLevelValues.set(${valueJson},${tmpId}${keySrc});\n`;
                })
                .join("");
              return `${transpileKtvalsForEval(statement, context)}${setsSrc}`;
            }

            default:
              throw ExpectNever(ktval);
          }
        }

        case KtvalFunctionPostludeT: {
          const functionSrc = `${transpileKtvalsForEval(ktval.body, context)}}`;
          const idJson = JSON.stringify(ktval.id);
          const set = `void _cu$c.transpileState.topLevelValues.set(${idJson},${functionSrc})`;
          const get = `_cu$c.transpileState.topLevelValues.get(${idJson})`;
          return `(() => {\n${set}\nreturn ${get}\n})()`;
        }

        case KtvalImportT: {
          const specifierJson = JSON.stringify(ktval.specifierForRepl);
          const awaitImport = ktvalOther(`await import(${specifierJson})`);
          const { statement, id: tmpId } = tmpVarOf(context, [awaitImport]);
          const importsSrc = ktval.ids
            .map((id) => {
              const idJson = JSON.stringify(id);
              return `_cu$c.transpileState.topLevelValues.set(${idJson},${tmpId}.${id});\n`;
            })
            .join("");
          return `${transpileKtvalsForEval(statement, context)}${importsSrc}`;
        }

        case KtvalImportStarAsT: {
          const idJson = JSON.stringify(ktval.id);
          const specifierJson = JSON.stringify(ktval.specifierForRepl);
          return `_cu$c.transpileState.topLevelValues.set(${idJson},await import(${specifierJson}));\n`;
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
  context: Context<TranspileModule>,
): JsSrc {
  return ktvals
    .map((ktval) => {
      switch (ktval.t) {
        case KtvalReferT:
          return ktval.id;

        case KtvalAssignT: {
          const expSrc = transpileKtvalsForModule(ktval.exp, context);
          return `${ktval.decl}${toJsAssignee(ktval, context)}=${expSrc};\n`;
        }

        case KtvalFunctionPostludeT: {
          return `${transpileKtvalsForModule(ktval.body, context)}}`;
        }

        case KtvalImportT: {
          if (context.transpileState.runtimeModuleEmission === "none") {
            return "";
          }
          const specifier = JSON.stringify(ktval.specifierForModule);
          return `import{${ktval.ids.join(", ")}}from${specifier};\n`;
        }

        case KtvalImportStarAsT: {
          if (context.transpileState.runtimeModuleEmission === "none") {
            return "";
          }
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
  context: Context<TranspileModule>,
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
            return `${transpileKtvalsForModule(key, context)}:${value}`;
          }
          return keyValue;
        })
        .join(",")}}`;
    default:
      throw ExpectNever(ktval);
  }
}
