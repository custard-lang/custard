import { Location, ReaderInput } from "./internal/types.js";

export type TokenKind = string;

export type EOF = null;

export const EOF: EOF = null;

export interface TokenAndRE {
  t: TokenKind;
  r: RegExp;
}

export interface MatchedToken extends Location {
  t: TokenKind;
  v: RegExpExecArray;
}

export const UNKNOWN_TOKEN: TokenAndRE = {
  t: "unknown",
  r: /\S+/y,
};

export class SpaceSkippingScanner {
  #res: TokenAndRE[];
  #input: ReaderInput;
  #position = 0;

  #line = 1;
  // Last position of linebreak.
  #lastLinebreakAt = 0;

  #lastToken: MatchedToken | EOF;

  constructor(res: TokenAndRE[], input: ReaderInput) {
    for (const { t, r } of res) {
      if (!r.sticky) {
        throw new Error(
          `Assertion failed: RegExp for token ${t} must enable the sticky flag`,
        );
      }
    }

    this.#res = res;
    this.#input = input;
    this.#lastToken = this.#next();
  }

  next(): MatchedToken | EOF {
    const lastToken = this.#lastToken;
    this.#lastToken = this.#next();
    return lastToken;
  }

  #next(): MatchedToken | EOF {
    // Skip spaces and record linebreak positions.
    const spacesMd = this.#scan(/\s*/y);
    if (spacesMd === EOF) {
      return EOF;
    }
    const spaces = spacesMd.v[0];
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
      const v = this.#scan(r);
      if (v !== EOF) {
        return { t, ...v };
      }
    }

    const unknown = this.#scan(UNKNOWN_TOKEN.r);
    if (unknown !== EOF) {
      return {
        t: UNKNOWN_TOKEN.t,
        ...unknown,
      };
    }
    return EOF;
  }

  peek(): MatchedToken | EOF {
    return this.#lastToken;
  }

  isAtEof(): boolean {
    return this.#lastToken === EOF;
  }

  #scan(r: RegExp): Omit<MatchedToken, "t"> | EOF {
    if (this.#position >= this.#input.contents.length) {
      return EOF;
    }

    r.lastIndex = this.#position;
    const md = r.exec(this.#input.contents);
    if (md === EOF) {
      return EOF;
    }
    this.#position = r.lastIndex;
    return {
      v: md,
      l: this.#line,
      c: md.index - this.#lastLinebreakAt + 1,
      f: this.#input.path,
    };
  }
}
