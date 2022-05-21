export type Form = List | Atom;

export type List = Form[];

export type Atom = Integer | Symbol;

export type Integer = {
  t: "Integer";
  v: string;
};

export type Symbol = {
  t: "Symbol";
  v: string;
};
