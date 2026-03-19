// Lemma Memory Module - Re-exports from core
export {
  generateId,
  detectProject,
  createFragment,
  findSimilarFragment,
  loadMemory,
  saveMemory,
  filterByProject,
  decayConfidence,
  searchAndSortFragments,
  formatMemoryForLLM,
  formatMemoryDetail,
  boostOnAccess,
  recordNegativeHit,
  trackAssociations,
  setMemoryDir
} from "./core.js";
