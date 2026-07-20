/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */
export async function importModuleFromJsSrc(
  src: string,
): Promise<{ [key: string]: any }> {
  //console.log(src);
  return await import(`data:application/javascript,${encodeURIComponent(src)}`);
}
