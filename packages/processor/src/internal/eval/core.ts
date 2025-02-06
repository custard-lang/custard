import { type Env, TranspileError } from "../types.js";
import { evalKtvals } from "../ktvals.js";

export async function evalForMacro(
  env: Env,
): Promise<undefined | TranspileError> {
  const { transpileState } = env;
  try {
    return await evalKtvals(
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
