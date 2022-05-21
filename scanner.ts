export class Scanner {
  private _lastToken: string | undefined = undefined;

  constructor(private _regex: RegExp, private _input: string) {}

  next(): string | undefined {
    this._lastToken = this._next();
    return this._lastToken;
  }

  peek(): string | undefined {
    this._lastToken ??= this._next();
    return this._lastToken;
  }

  private _next(): string | undefined {
    return this._regex.exec(this._input)?.[1];
  }
}
