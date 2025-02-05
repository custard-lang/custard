import { _cu$eval } from "../isolated-eval.js";
import { type Env, TranspileError } from "../types.js";

export async function evalForMacro(
  env: Env,
): Promise<undefined | TranspileError> {
  const { transpileState } = env;
  try {
    return await _cu$eval(
      transpileState.transpiledSrc.slice(transpileState.evaluatedUpTo),
      [],
      env,
    );
  } catch (e) {
    if (e instanceof Error) {
      return new TranspileError(
        "An error occurred before/when evaluating a macro",
        {
          cause: e,
        },
      );
    }
  } finally {
    transpileState.evaluatedUpTo = transpileState.transpiledSrc.length;
  }
}
