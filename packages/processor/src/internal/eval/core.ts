import { type Context, Ktvals, TranspileError } from "../types.js";
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

export async function evalForMacroArgument(
  ktvals: Ktvals<string>,
  context: Context,
  // This function is used to evaluate macro arguments, which can be of literally any type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | TranspileError> {
  const { transpileState } = context;
  try {
    return await evalKtvals([], ktvals, context);
  } catch (e) {
    if (e instanceof Error) {
      return new TranspileError(
        "An error occurred when evaluating an argument to a macro",
        {
          cause: e,
        },
      );
    }
  } finally {
    transpileState.evaluatedUpTo = transpileState.transpiledSrc.length;
  }
}
