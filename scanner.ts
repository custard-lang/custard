export class Scanner {
  private _lastToken: string | undefined = this._next();

  constructor(private _regex: RegExp, private _input: string) {}

  next(): string | undefined {
    const lastToken = this._lastToken;
    this._lastToken = this._next();
    return lastToken;
  }

  peek(): string | undefined {
    return this._lastToken;
  }

  private _next(): string | undefined {
    return this._regex.exec(this._input)?.[1];
  }
}
