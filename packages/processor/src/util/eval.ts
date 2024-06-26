/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
export async function evalModule(src: string): Promise<{ [key: string]: any }> {
  return await import(`data:application/javascript,${encodeURIComponent(src)}`);
}
