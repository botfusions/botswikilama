export {
  detectVault,
  setupVault,
  readPage,
  writePage,
  listFiles,
  listRawFiles,
  findNewSources,
  appendToLog,
  updateIndex,
  searchWiki,
  lintWiki,
  getVaultStats,
  validateVaultPath,
  sanitizeYamlValue,
  sanitizeMarkdownHeading,
} from "./core.js";
export type { LintFinding } from "./core.js";
