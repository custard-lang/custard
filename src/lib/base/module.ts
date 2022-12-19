import * as EnvF from "../../env";
import { CuArray, Env, isCuSymbol, JsSrc, Scope, TranspileError } from "../../types";

export function module(): Scope {
  const b: Scope = new Map();

  b.set("import", (env: Env, ...forms: CuArray): JsSrc | TranspileError => {
    if (forms.length !== 1) {
      return new TranspileError("The arguments of `import` must be 1.");
    }
    const [id] = forms;
    if (!isCuSymbol(id)) {
      return new TranspileError("The argument of `import` must be a Symbol.");
    }

    // TODO: ライブラリーのパスを、現在transpileしているファイルからの相対パスにした方がよさそう
    const modulePath = EnvF.findModule(env, id.v);
    if (modulePath === undefined) {
      return new TranspileError(`No module \`${id.v}\` registered in the Module Paths`);
    }
    return `import * as ${id.v} from "${modulePath}"`;
  });

  return b;
}
