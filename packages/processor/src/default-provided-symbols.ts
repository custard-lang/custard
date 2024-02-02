export const defaultProvidedSymbolsConfig = `
(const modulePaths (createMap))
(modulePaths.set "base" (text standardModuleRoot "/base.js"))
(modulePaths.set "async" (text standardModuleRoot "/async.js"))
{
  modulePaths,
  implicitStatements: "(importAnyOf base)",
  jsTopLevels: ["console"],
}
`;
