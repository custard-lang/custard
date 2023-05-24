export const defaultProvidedSymbolsConfig = `
(const modulePaths (Map))
(modulePaths.set "async" "./lib/async.js")
{
  modulePaths,
  builtinModulePaths: [(text standardRoot "/base.js")],
  jsTopLevels: ["console"],
}
`;
