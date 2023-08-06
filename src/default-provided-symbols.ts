export const defaultProvidedSymbolsConfig = `
(const modulePaths (Map))
(modulePaths.set "async" "./lib/async.js")
{
  modulePaths,
  builtinModulePaths: [(text standardModuleRoot "/base.js")],
  jsTopLevels: ["console"],
}
`;
