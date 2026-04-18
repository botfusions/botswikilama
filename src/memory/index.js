// Lemma Memory Module - Re-exports from core
export {
  generateId,
  detectProject,
  createFragment,
  findSimilarFragment,
  loadMemory,
  saveMemory,
  saveMemorySafe,
  applySessionDecay,
  filterByProject,
  decayConfidence,
  searchAndSortFragments,
  formatMemoryForLLM,
  formatMemoryDetail,
  boostOnAccess,
  recordNegativeHit,
  trackAssociations,
  setMemoryDir,
  calculateStats,
  formatStats,
  auditMemory,
  formatAuditReport
} from "./core.js";
