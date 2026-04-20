export class TranspileError extends Error {
  override readonly name = "TranspileError";
  readonly code: Code = "CSTD_OTHER";

  // NOTE: Use this instead of instanceof to avoid https://github.com/vitejs/vite/issues/9528
  _cu$isTranspileError = true;
  static is(e: unknown): e is TranspileError {
    return (e as { [key: string]: unknown } | null)
      ?._cu$isTranspileError as boolean;
  }

  static wrap(cause: unknown): TranspileError {
    return new TranspileError(String(cause), { cause });
  }

  static newWithCode(code: Code, message: string): TranspileError {
    const e = new this(message);
    (e as { code: Code }).code = code;
    return e;
  }

  static macroReturnedInvalidValue(o: unknown): TranspileError {
    return this.newWithCode(
      "CSTD_MACRO_RETURNED_INVALID_VALUE",
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `A macro returned a value containing one that cannot be converted to a Form: \`${o}\`.`,
    );
  }
}

export type Code = "CSTD_OTHER" | "CSTD_MACRO_RETURNED_INVALID_VALUE";
