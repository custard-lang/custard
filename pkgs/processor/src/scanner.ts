import type { FilePath, Location, ReaderInput } from "./types.ts";

export type TokenKind = string;

export interface Eof extends Location {
  t: "EOF";
}

export function eof(l: Location): Eof {
  return { t: "EOF", ...l };
}

export function isEof(
  v: Omit<MatchedToken, "t"> | MatchedToken | Eof,
): v is Eof {
  return "t" in v && v.t === "EOF";
}

export interface TokenAndRE {
  t: TokenKind;
  r: RegExp;
}

export interface MatchedToken extends Location {
  t: TokenKind;
  m: RegExpExecArray;
}

export class SpaceSkippingScanner {
  readonly #res: TokenAndRE[];
  readonly #path: FilePath;
  #contents: string;
  #position = 0;

  #line: number;
  // Last position of linebreak.
  #lastLinebreakAt = 0;

  #lastToken: MatchedToken | Eof;

  constructor(res: TokenAndRE[], input: ReaderInput) {
    for (const { t, r } of res) {
      if (!r.sticky) {
        throw new Error(
          `Assertion failed: RegExp for token ${t} must enable the sticky flag`,
        );
      }
    }

    this.#res = res;
    this.#path = input.path;
    this.#contents = input.contents;
    this.#line = input.initialLineNumber;
    this.#lastToken = this.#next();
  }

  next(): MatchedToken | Eof {
    const lastToken = this.#lastToken;
    this.#lastToken = this.#next();
    return lastToken;
  }

  #next(): MatchedToken | Eof {
    // Skip spaces and record linebreak positions. This regexp defnitely matches.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const spacesMd = this.scan(/\s*/y)!;
    if (isEof(spacesMd)) {
      return spacesMd;
    }
    const spaces = spacesMd.m[0];
    let i = spaces.length - 1;
    for (const c of spaces) {
      if (c === "\n") {
        // After this.#scan(/\s*/y)!, this.#position points to the next position,
        // which is at the end of the spaces. So we need to subtract i from this.#position.
        this.#lastLinebreakAt = this.#position - i;
        ++this.#line;
      }
      --i;
    }

    for (const { t, r } of this.#res) {
      const v = this.scan(r);
      if (v === null) {
        continue;
      }
      if (isEof(v)) {
        return v;
      }
      return { t, ...v };
    }
    throw new Error(
      `No token found at ${this.#position}. You must give token definitions matching any characters.`,
    );
  }

  peek(): MatchedToken | Eof {
    return this.#lastToken;
  }

  overwriteLastToken(token: MatchedToken): void {
    this.#lastToken = token;
  }

  // for debugging purposes
  getPosition(): number {
    return this.#position;
  }
  getContents(): string {
    return this.#contents;
  }

  isAtEof(): boolean {
    return this.#lastToken.t === "EOF";
  }

  scan(r: RegExp): Omit<MatchedToken, "t"> | Eof | null {
    if (this.#position >= this.#contents.length) {
      return eof({
        l: this.#line,
        c: this.#position - this.#lastLinebreakAt + 1,
        f: this.#path,
      });
    }

    r.lastIndex = this.#position;
    const m = r.exec(this.#contents);
    if (m === null) {
      return null;
    }
    this.#position = r.lastIndex;
    return {
      m,
      l: this.#line,
      c: m.index - this.#lastLinebreakAt + 1,
      f: this.#path,
    };
  }

  feed(contents: string): void {
    // When the scanner reaches the end of the input,
    // the string fed next should start from the beginning of the line.
    this.#lastLinebreakAt = 0;
    this.#position = 0;
    ++this.#line;

    this.#contents = contents;
  }
}
