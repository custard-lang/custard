import { type Context, TranspileError } from "../types.js";
import { evalKtvals } from "../ktvals.js";

export async function evalForMacro(
  context: Context,
): Promise<undefined | TranspileError> {
  const { transpileState } = context;
  try {
    await evalKtvals(
      transpileState.transpiledSrc.slice(transpileState.evaluatedUpTo),
      [],
      context,
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
