# custard

## REPL

After `git clone` and `npm install`:

```bash
$ npm run custard repl
```

## Transpile

After `git clone` and `npm install`:

```bash
$ npm run -- custard transpile -p ./path/to/provided-symbols.cstd ./path/to/src.cstd
```

## Transpile and Run

After `git clone` and `npm install`:

```bash
$ npm run -- custard run -p ./path/to/provided-symbols.cstd ./path/to/src.cstd [...args]
```

## Test

After `git clone` and `npm install`:

```bash
$ npm run -ws --if-present test -- run
```
