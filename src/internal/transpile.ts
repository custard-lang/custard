import { assertNonNull, expectNever } from "../util/error.js";

import {
  Block,
  Form,
  Id,
  isContextualKeyword,
  isCuSymbol,
  TranspileError,
  Writer,
  isPropertyAccess,
  showSymbolAccess,
  isNamespace,
  isMarkedFunctionWithEnv,
  isMarkedDirectWriter,
  LiteralObject,
  PropertyAccess,
  CuSymbol,
  JsModule,
  JsSrc,
  JsModuleWithResult,
  canBePseudoTopLevelReferenced,
  isProvidedConst,
} from "../internal/types.js";
import {
  CU_ENV,
  pseudoTopLevelReference,
  pseudoTopLevelReferenceToPropertyAccess,
} from "./cu-env.js";
import { Env } from "./types.js";
import * as EnvF from "./env.js";
import { readBlock } from "../reader.js";
import { ParseError } from "../grammar.js";
import { isStatement } from "../lib/base/common.js";

export async function transpileExpression(
  ast: Form,
  env: Env,
): Promise<JsModule | TranspileError> {
  const r = await transpileExpressionWithNextCall(ast, env);
  if (r instanceof TranspileError) {
    return r;
  }
  return r[0];
}

type NextCall = {
  writer: Writer;
  sym: CuSymbol | PropertyAccess;
};

type JsModuleAndNextCall = [JsModule, NextCall | undefined];

async function transpileExpressionWithNextCall(
  ast: Form,
  env: Env,
): Promise<JsModuleAndNextCall | TranspileError> {
  if (ast instanceof Array) {
    if (ast.length === 0) {
      return new TranspileError("Invalid function call: empty");
    }

    const [funcForm, ...args] = ast;

    const funcSrcAndNextCall = await transpileExpressionWithNextCall(
      funcForm,
      env,
    );
    if (funcSrcAndNextCall instanceof TranspileError) {
      return funcSrcAndNextCall;
    }

    const [funcSrc, nc] = funcSrcAndNextCall;

    if (nc === undefined) {
      const argsSrc = await transpileJoinWithComma(args, env);
      if (argsSrc instanceof TranspileError) {
        return argsSrc;
      }
      return [
        concatJsModules(
          jsModuleOfBody("("),
          funcSrc,
          jsModuleOfBody(")("),
          argsSrc,
          jsModuleOfBody(")"),
        ),
        undefined,
      ];
    }

    const { writer, sym } = nc;
    if (isContextualKeyword(writer)) {
      return new TranspileError(
        `\`${showSymbolAccess(sym)}\` must be used with \`${
          writer.companion
        }\`!`,
      );
    }
    if (isNamespace(writer)) {
      return new TranspileError(
        `\`${showSymbolAccess(
          sym,
        )}\` is just a namespace. Doesn't represent a function!`,
      );
    }

    if (canBePseudoTopLevelReferenced(writer) || isProvidedConst(writer)) {
      const argsSrc = await transpileJoinWithComma(args, env);
      if (argsSrc instanceof TranspileError) {
        return argsSrc;
      }
      return [
        concatJsModules(
          funcSrc,
          jsModuleOfBody("("),
          argsSrc,
          jsModuleOfBody(")"),
        ),
        undefined,
      ];
    }
    if (isMarkedFunctionWithEnv(writer)) {
      const argsSrc = await transpileJoinWithComma(args, env);
      if (argsSrc instanceof TranspileError) {
        return argsSrc;
      }
      return [
        concatJsModules(
          funcSrc,
          jsModuleOfBody(`.call(${CU_ENV},`),
          argsSrc,
          jsModuleOfBody(")"),
        ),
        undefined,
      ];
    }

    if (isMarkedDirectWriter(writer)) {
      const srcP = writer.call(env, ...args);
      const src = srcP instanceof Promise ? await srcP : srcP;
      return src instanceof TranspileError ? src : [src, undefined];
    }

    return expectNever(writer) as JsModuleAndNextCall;
  }

  let r: EnvF.WriterWithIsAtTopLevel | TranspileError;
  switch (typeof ast) {
    case "string":
      return [jsModuleOfBody(JSON.stringify(ast)), undefined];
    case "undefined":
      return [jsModuleOfBody("void 0"), undefined];
    case "number":
      return [jsModuleOfBody(`${ast}`), undefined];
    case "boolean":
      return [jsModuleOfBody(ast ? "!0" : "!1"), undefined];
    case "object":
      switch (ast.t) {
        case "Symbol":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          if (EnvF.writerIsAtReplTopLevel(env, r)) {
            return [
              jsModuleOfBody(pseudoTopLevelReference(ast.v)),
              { writer: r.writer, sym: ast },
            ];
          }
          return [jsModuleOfBody(ast.v), { writer: r.writer, sym: ast }];
        case "PropertyAccess":
          r = EnvF.referTo(env, ast);
          if (r instanceof TranspileError) {
            return r;
          }
          if (EnvF.writerIsAtReplTopLevel(env, r)) {
            return [
              jsModuleOfBody(pseudoTopLevelReferenceToPropertyAccess(ast)),
              { writer: r.writer, sym: ast },
            ];
          }
          return [
            jsModuleOfBody(ast.v.join(".")),
            { writer: r.writer, sym: ast },
          ];
        case "LiteralArray":
          const elementsSrc = await transpileJoinWithComma(ast.v, env);
          if (elementsSrc instanceof TranspileError) {
            return elementsSrc;
          }
          return [
            concatJsModules(
              jsModuleOfBody("["),
              elementsSrc,
              jsModuleOfBody("]"),
            ),
            undefined,
          ];
        case "LiteralObject":
          const kvSrc = await transpileLiteralObject(ast, env);
          if (kvSrc instanceof TranspileError) {
            return kvSrc;
          }
          return [kvSrc, undefined];
        case "Integer32":
          return [jsModuleOfBody(`${ast.v}`), undefined];
      }
    default:
      return expectNever(ast) as JsModuleAndNextCall;
  }
}

async function transpileLiteralObject(
  ast: LiteralObject,
  env: Env,
): Promise<JsModule | TranspileError> {
  let objectContents = emptyJsModule();
  for (const kv of ast.v) {
    let kvSrc: JsModule;
    if (isCuSymbol(kv)) {
      const f = EnvF.referTo(env, kv);
      if (f instanceof TranspileError) {
        return f;
      }
      if (EnvF.writerIsAtReplTopLevel(env, f)) {
        kvSrc = jsModuleOfBody(`${kv.v}: ${pseudoTopLevelReference(kv.v)}`);
      } else {
        kvSrc = jsModuleOfBody(kv.v);
      }
    } else {
      const [k, v] = kv;
      // TODO: only CuSymbol and LiteralArray with only one element should be valid.
      const kSrc = isCuSymbol(k)
        ? jsModuleOfBody(k.v)
        : await transpileExpression(k, env);
      if (kSrc instanceof TranspileError) {
        return kSrc;
      }

      const vSrc = await transpileExpression(v, env);
      if (vSrc instanceof TranspileError) {
        return vSrc;
      }

      kvSrc = concatJsModules(kSrc, jsModuleOfBody(": "), vSrc);
    }
    objectContents = concatJsModules(
      objectContents,
      kvSrc,
      jsModuleOfBody(","),
    );
  }
  return extendBody(objectContents, "{", "}");
}

export async function transpileBlock(
  forms: Block,
  env: Env,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<JsModule | TranspileError> {
  const jsSrc = await transpileBlockCore(forms, env, extraOptions);

  if (jsSrc instanceof TranspileError) {
    return jsSrc;
  }
  const { imports, body, lastExpression } = jsSrc;
  if (lastExpression !== "") {
    return {
      imports,
      body: `${body}export default ${lastExpression}`,
    };
  }

  return {
    imports,
    body,
  };
}

export async function transpileBlockCore(
  forms: Block,
  env: Env,
  extraOptions: { mayHaveResult: boolean } = { mayHaveResult: false },
): Promise<JsModuleWithResult | TranspileError> {
  let jsSrc = emptyJsModule();
  for (const form of forms.slice(0, -1)) {
    const s = await transpileExpression(form, env);
    if (s instanceof Error) {
      return s;
    }
    jsSrc = appendJsStatement(jsSrc, s);
  }

  const lastForm = forms[forms.length - 1];
  const last = await transpileExpression(lastForm, env);
  if (last instanceof Error) {
    return last;
  }

  const lastIsExpression = !isStatement(env, lastForm);
  if (lastIsExpression && extraOptions.mayHaveResult) {
    return {
      ...jsSrc,
      imports: `${jsSrc.imports}${last.imports}`,
      lastExpression: last.body,
    };
  }

  jsSrc = appendJsStatement(jsSrc, last);

  return {
    ...jsSrc,
    lastExpression: "",
  };
}

export async function transpileString(
  formsString: string,
  env: Env,
): Promise<JsModule | Error> {
  const forms = readBlock(formsString);
  if (forms instanceof ParseError) {
    return forms;
  }
  return transpileBlock(forms, env);
}

export function asCall(form: Form): [Id, ...Form[]] | undefined {
  if (!(form instanceof Array)) {
    return;
  }
  const id = form[0];
  if (isCuSymbol(id)) {
    return [id.v, ...form.slice(1)];
  }
  if (isPropertyAccess(id)) {
    const msg = "Assertion failure: an empty PropertyAccess";
    return [assertNonNull(id.v[0], msg), ...form.slice(1)];
  }
}

// TODO: accept only expression form (not a statement)
export async function transpileJoinWithComma(
  xs: Form[],
  env: Env,
): Promise<JsModule | TranspileError> {
  let result = emptyJsModule();
  const lastI = xs.length - 1;
  for (const [i, x] of xs.entries()) {
    const r = await transpileExpression(x, env);
    if (r instanceof TranspileError) {
      return r;
    }
    if (i === lastI) {
      result = concatJsModules(result, r);
    } else {
      result = concatJsModules(result, r, jsModuleOfBody(","));
    }
  }
  return result;
}

export function appendJsStatement(
  jsBlock: JsModule,
  jsExpression: JsModule,
): JsModule {
  return {
    imports: jsExpression.imports
      ? `${jsBlock.imports}${jsExpression.imports};\n`
      : jsBlock.imports,
    body: `${jsBlock.body}${jsExpression.body};\n`,
  };
}

export function concatJsModules(
  a: JsModule,
  b: JsModule,
  ...left: JsModule[]
): JsModule {
  function plus(x: JsModule, y: JsModule): JsModule {
    return {
      imports: `${x.imports}${y.imports}`,
      body: `${x.body}${y.body}`,
    };
  }
  return left.reduce(plus, plus(a, b));
}

export function extendBody(
  jsExpression: JsModule,
  prefix: JsSrc = "",
  suffix: JsSrc = "",
): JsModule {
  return {
    ...jsExpression,
    body: `${prefix}${jsExpression.body}${suffix}`,
  };
}

export function jsModuleOfBody(body: JsSrc): JsModule {
  return { imports: "", body };
}

export function jsModuleOfImports(imports: JsSrc): JsModule {
  return { imports, body: "" };
}

export function emptyJsModule(): JsModule {
  return { imports: "", body: "" };
}
