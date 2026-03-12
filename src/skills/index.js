// Lemma Skills Module - Re-exports
// Main entry point for skills functionality

export {
  generateSkillId,
  getToday,
  createSkill,
  loadSkills,
  saveSkills,
  promoteToSkill,
  findSkill,
  updateSkill,
  deleteSkill,
  practiceSkill,
  getTopSkills,
  getSkillsByCategory,
  formatSkillsForLLM,
  suggestSkills,
  formatSuggestions,
  formatSkillDetail,
  TASK_SKILL_MAP
} from "./core.js";
