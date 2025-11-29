# custard

## REPL

After `git clone` and `pnpm install`:

```bash
$ pnpm run custard repl
```

## Transpile

After `git clone` and `pnpm install`:

```bash
$ pnpm run -- custard transpile -p ./path/to/provided-symbols.cstd ./path/to/src.cstd
```

## Transpile and Run

After `git clone` and `pnpm install`:

```bash
$ pnpm run -- custard run -p ./path/to/provided-symbols.cstd ./path/to/src.cstd [...args]
```

## Test

After `git clone` and `pnpm install`:

```bash
$ pnpm run -ws --if-present test -- run
```
