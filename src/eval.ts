import * as path from "node:path";
import * as vm from "node:vm";
import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import type { RunningScriptOptions } from "node:vm";

import { Block, Env, FilePath, Form, TranspileRepl } from "./types.js";
import { transpileStatement, transpileBlock } from "./transpile.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

type Module = any;

function createFallbackLinker(
  src: Stats,
  srcPath: FilePath,
): (specifier: string, refererModule?: Module) => Promise<Module> {
  return async function fallbackLinker(specifier: string): Promise<Module> {
    //console.log(1, srcPath, specifier);
    const refererDir = src.isDirectory() ? srcPath : path.dirname(srcPath);

    const relPath = stripFileProtocol(specifier);
    //console.log(2, refererDir, relPath);
    if (relPath.startsWith("./") || relPath.startsWith("../")) {
      const fullPath = path.resolve(refererDir, relPath);

      // TODO: cache modules by path.
      const modContent = await fs.readFile(fullPath, "utf-8");
      //console.log(2.1, relPath);
      const mod = new (vm as any).SourceTextModule(modContent, {
        importModuleDynamically: fallbackLinker,
        identifier: specifier,
      });
      console.log(3, refererDir, fullPath);
      await mod.link(createFallbackLinker(await fs.stat(fullPath), fullPath));
      console.log(3.1, refererDir, fullPath);
      await mod.evaluate();
      console.log(3.2, refererDir, fullPath);
      return mod;
    }
    console.log(4, relPath);
    return await import(relPath);
  };
}

function createVmOptions(options: TranspileRepl): RunningScriptOptions {
  const { src, srcPath } = options;
  return {
    // NOTE: importModuleDynamically is not declared in node/vm.d.ts.
    // NOTE: TODO: usually call the native import, and fall back if the error is ERR_VM_MODULE_NOT_MODULE
    //             We can't catch the exception here, it's thrown by vm.runInContext.
    importModuleDynamically: createFallbackLinker(src, srcPath),
    //async (specifier: string) => // await import(specifier),

    filename: src.isDirectory() ? `${srcPath}/(custard repl)` : srcPath,
  } as RunningScriptOptions;
}

export async function evalForm(
  ast: Form,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileStatement(ast, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }
  return await vm.runInContext(jsSrc, env.o.vmContext, createVmOptions(env.o));
}

export async function evalBlock(
  forms: Block,
  env: Env<TranspileRepl>,
): Promise<any | Error> {
  const jsSrc = await transpileBlock(forms, env);
  if (jsSrc instanceof Error) {
    return jsSrc;
  }

  return await vm.runInContext(jsSrc, env.o.vmContext, createVmOptions(env.o));
}

function stripFileProtocol(p: string): string {
  const protocol = "file://";
  return p.startsWith(protocol) ? p.slice(protocol.length) : p;
}
