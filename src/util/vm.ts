import * as vm from "node:vm";

const Brand: unique symbol = Symbol("VmContext");

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type VmContext = Record<string, any> & Record<typeof Brand, never>;

export function createVmContext(): VmContext {
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
  const vmContext = Object.create(null);

  /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
  vm.createContext(vmContext);

  /* eslint-disable-next-line @typescript-eslint/no-unsafe-return */
  return vmContext;
}
