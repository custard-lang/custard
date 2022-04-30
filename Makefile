grammar: grammar.ts

%.ts: %.peg
	npx tspeg $(*).peg $(*).ts
