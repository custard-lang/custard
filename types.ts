export type Value = List | Atom;

export type List = [Value];

export type Atom = Integer | Symbol;

export type Integer = {
  t: "Integer";
  v: string;
};

export type Symbol = {
  t: "Symbol";
  v: string;
};
