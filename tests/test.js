import assert from "assert";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

// Get directory of current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test isolation - create temp directory
let tempDir;

// Import the memory module functions dynamically with path override
async function importWithOverride(memoryFilePath) {
  // Create a temporary module that overrides the MEMORY_FILE
  const tempModulePath = path.join(tempDir, `memory-core-${Date.now()}.mjs`);
  const originalCode = await fs.readFile(
    path.join(__dirname, "../src/memory/core.js"),
    "utf-8"
  );

  // Override MEMORY_FILE constant - use forward slashes for JS string
  const normalizedPath = memoryFilePath.replace(/\\/g, "/");

  // Replace fuse.js import with inline mock for tests
  const fuseMock = `
// Fuse.js mock for tests
class Fuse {
  constructor(items, options) {
    this.items = items;
    this.options = options;
  }
  search(query, { limit } = {}) {
    const threshold = this.options.threshold || 0.4;
    const keys = this.options.keys || [];
    const results = [];
    const queryLower = query.toLowerCase();

    for (const item of this.items) {
      let score = 1;
      let matched = false;

      for (const keyDef of keys) {
        const key = typeof keyDef === 'object' ? keyDef.name : keyDef;
        const value = (item[key] || '').toLowerCase();
        if (value.includes(queryLower) || queryLower.includes(value)) {
          matched = true;
          break;
        }
      }

      if (matched) {
        results.push({ item, score });
        if (limit && results.length >= limit) break;
      }
    }
    return results;
  }
}
`;

  const modifiedCode = originalCode
    .replace(/import Fuse from "fuse\.js";/, fuseMock)
    .replace(
      /const MEMORY_FILE = path\.join\(MEMORY_DIR, "memory\.jsonl"\);/,
      `const MEMORY_FILE = "${normalizedPath}";`
    );

  await fs.writeFile(tempModulePath, modifiedCode);

  // Use file:// URL for Windows compatibility
  return import(pathToFileURL(tempModulePath).href);
}

// Test result tracking
let passed = 0;
let failed = 0;

function runTest(name, testFn) {
  return testFn()
    .then(() => {
      passed++;
      console.log(`✓ ${name}`);
    })
    .catch((error) => {
      failed++;
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error.message}`);
    });
}

// ============================================
// MEMORY TESTS
// ============================================

// Test 1: loadMemory - empty file
async function test_loadMemory_emptyFile() {
  const memoryFile = path.join(tempDir, "empty.jsonl");
  await fs.writeFile(memoryFile, "");

  const core = await importWithOverride(memoryFile);
  const fragments = core.loadMemory();
  assert.deepStrictEqual(fragments, [], "Empty file should return empty array");
}

// Test 2: loadMemory - with fragments
async function test_loadMemory_withFragments() {
  const memoryFile = path.join(tempDir, "fragments.jsonl");

  const fragment1 = {
    id: "m123abc",
    title: "Test Title 1",
    fragment: "Test content 1",
    confidence: 0.9,
    source: "ai",
    created: "2026-03-01",
    accessed: 0,
  };

  const fragment2 = {
    id: "m789xyz",
    title: "Test Title 2",
    fragment: "Test content 2",
    confidence: 0.8,
    source: "user",
    created: "2026-03-02",
    accessed: 5,
  };

  const jsonl = JSON.stringify(fragment1) + "\n" + JSON.stringify(fragment2) + "\n";
  await fs.writeFile(memoryFile, jsonl);

  const core = await importWithOverride(memoryFile);
  const fragments = core.loadMemory();

  assert.strictEqual(fragments.length, 2, "Should load 2 fragments");
  assert.strictEqual(fragments[0].fragment, "Test content 1");
  assert.strictEqual(fragments[0].title, "Test Title 1");
  assert.strictEqual(fragments[1].fragment, "Test content 2");
  assert.strictEqual(fragments[1].title, "Test Title 2");
}

// Test 3: saveMemory - creates directory
async function test_saveMemory_createsDirectory() {
  const newDir = path.join(tempDir, "new", "nested", "dir");
  const memoryFile = path.join(newDir, "memory.jsonl");

  const core = await importWithOverride(memoryFile);

  const fragment = core.createFragment("Test", "ai");
  core.saveMemory([fragment]);

  const stats = await fs.stat(newDir);
  assert(stats.isDirectory(), "Directory should be created");

  const content = await fs.readFile(memoryFile, "utf-8");
  assert(content.includes("Test"), "File should contain fragment");
}

// Test 4: decayConfidence - reduces correctly
async function test_decayConfidence_reducesCorrectly() {
  const core = await importWithOverride(path.join(tempDir, "decay1.jsonl"));

  const now = new Date();
  // Simulate memory accessed today
  const recentTime = now.toISOString();

  const fragment1 = {
    id: "m000001",
    title: "Test 1",
    fragment: "Test content 1",
    confidence: 1.0,
    source: "ai",
    created: recentTime,
    lastAccessed: recentTime,
    accessed: 0,
  };

  const fragment2 = {
    id: "m000002",
    title: "Test 2",
    fragment: "Test content 2",
    confidence: 1.0,
    source: "ai",
    created: recentTime,
    lastAccessed: recentTime,
    accessed: 5,
  };

  const result = core.decayConfidence([fragment1, fragment2]);

  // Base decay with 0 accessed = 0.05 modifier
  // Time decay with 0 days = 1.0 multiplier
  // Decay step: 0.05 * 1.0 = 0.05
  // New confidence: 1.0 - 0.05 = 0.95
  assert(Math.abs(result[0].confidence - 0.95) < 0.001, "Never accessed fragment should lose 0.05");

  // Base decay with 5 accessed = 0.05 - 0.025 = 0.025 modifier
  // Time decay with 0 days = 1.0 multiplier
  // Decay step: 0.025 * 1.0 = 0.025
  // New confidence: 1.0 - 0.025 = 0.975
  assert(Math.abs(result[1].confidence - 0.975) < 0.001, "5x accessed fragment should lose 0.025");
}

// Test 5: decayConfidence - removes low fragments
async function test_decayConfidence_removesLowFragments() {
  const core = await importWithOverride(path.join(tempDir, "decay2.jsonl"));

  const fragment1 = {
    id: "m000003",
    title: "Keep me",
    fragment: "Keep me content",
    confidence: 0.5,
    source: "ai",
    created: "2026-03-01",
    accessed: 0,
  };

  const fragment2 = {
    id: "m000004",
    title: "Remove me",
    fragment: "Remove me content",
    confidence: 0.1,
    source: "ai",
    created: "2026-03-01",
    accessed: 0,
  };

  const result = core.decayConfidence([fragment1, fragment2]);

  // fragment2 decays to 0.05 and is removed (confidence < 0.1)
  assert.strictEqual(result.length, 1, "Low confidence fragment should be removed");
  assert.strictEqual(result[0].id, "m000003", "High confidence fragment should remain");
}

// Test 6: decayConfidence - time decay multiplier
async function test_decayConfidence_timeDecayMultiplier() {
  const core = await importWithOverride(path.join(tempDir, "decay-time.jsonl"));

  // Create a fragment last accessed 10 days ago
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const oldFragment = {
    id: "m000005",
    title: "Old memory",
    fragment: "Old content",
    confidence: 1.0,
    source: "ai",
    created: "2026-02-01",
    lastAccessed: tenDaysAgo,
    accessed: 0,
  };

  const result = core.decayConfidence([oldFragment]);

  // Base decay: 0.05 (0 accessed)
  // Time multiplier: 1 + (10 * 0.05) = 1.5
  // Decay step: 0.05 * 1.5 = 0.075
  // New confidence: 1.0 - 0.075 = 0.925
  assert(Math.abs(result[0].confidence - 0.925) < 0.001, "Old memory should decay faster with time multiplier");
}

// Test 7: decayConfidence - resets accessed counter
async function test_decayConfidence_resetsAccessedCounter() {
  const core = await importWithOverride(path.join(tempDir, "decay-reset.jsonl"));

  const fragment = {
    id: "m000006",
    title: "Test",
    fragment: "Content",
    confidence: 1.0,
    source: "ai",
    created: "2026-03-01",
    lastAccessed: new Date().toISOString(),
    accessed: 10,
  };

  const result = core.decayConfidence([fragment]);

  assert.strictEqual(result[0].accessed, 0, "Decay should reset accessed counter");
}

// Test 8: formatMemoryForLLM - correct format
async function test_formatMemoryForLLM_correctFormat() {
  const core = await importWithOverride(path.join(tempDir, "format.jsonl"));

  const fragments = [
    {
      id: "m123abc",
      title: "Important fact",
      fragment: "This is the detailed content of important fact",
      confidence: 1.0,
      source: "ai",
      created: "2026-03-01",
      accessed: 0,
    },
    {
      id: "m789xyz",
      title: "Another fact",
      fragment: "This is another detailed fact content",
      confidence: 0.4,
      source: "user",
      created: "2026-03-01",
      accessed: 5,
    },
  ];

  const formatted = core.formatMemoryForLLM(fragments);

  assert(formatted.includes("=== LEMMA MEMORY FRAGMENTS ==="), "Should include header");
  assert(formatted.includes("█████"), "Should include full confidence bar for 1.0");
  assert(formatted.includes("██░░░"), "Should include 0.4 confidence bar");
  assert(formatted.includes("Important fact"), "Should include title");
  assert(formatted.includes("detailed content"), "Should include fragment content");
  assert(formatted.includes("m123abc"), "Should include fragment ID");
  assert(formatted.includes("🤖"), "Should include AI icon");
  assert(formatted.includes("👤"), "Should include user icon");
}

// Test 9: formatMemoryForLLM - empty fragments
async function test_formatMemoryForLLM_emptyFragments() {
  const core = await importWithOverride(path.join(tempDir, "format-empty.jsonl"));

  const formatted = core.formatMemoryForLLM([]);

  assert(formatted.includes("=== LEMMA MEMORY FRAGMENTS ==="), "Should include header");
  assert(formatted.includes("(no active fragments)"), "Should indicate no fragments");
}

// Test 10: formatMemoryForLLM - with project header
async function test_formatMemoryForLLM_withProject() {
  const core = await importWithOverride(path.join(tempDir, "format-project.jsonl"));

  const formatted = core.formatMemoryForLLM([], "MyProject");

  assert(formatted.includes("(project: MyProject)"), "Should include project name in header");
}

// Test 11: generateId - correct format
async function test_generateId_correctFormat() {
  const core = await importWithOverride(path.join(tempDir, "id.jsonl"));

  const id = core.generateId();

  assert(id.startsWith("m"), "ID should start with 'm'");
  assert.strictEqual(id.length, 7, "ID should be 7 characters long");

  const hexPart = id.slice(1);
  assert(/^[0-9a-f]{6}$/.test(hexPart), "Last 6 chars should be hexadecimal");
}

// Test 12: createFragment - valid object
async function test_createFragment_validObject() {
  const core = await importWithOverride(path.join(tempDir, "create.jsonl"));

  const fragment = core.createFragment("Test content", "user", "Test Title", "myproject");

  assert(fragment.id, "Should have id");
  assert.strictEqual(fragment.title, "Test Title", "Should have correct title");
  assert.strictEqual(fragment.fragment, "Test content", "Should have correct fragment text");
  assert.strictEqual(fragment.project, "myproject", "Should have correct project");
  assert.strictEqual(fragment.source, "user", "Should have correct source");
  assert.strictEqual(fragment.confidence, 1.0, "Should start with confidence 1.0");
  assert.strictEqual(fragment.accessed, 0, "Should start with accessed 0");
  assert(fragment.created, "Should have created date");
  assert(fragment.lastAccessed, "Should have lastAccessed date");
  assert(fragment.id.startsWith("m"), "ID should start with 'm'");
}

// Test 13: createFragment - auto title generation
async function test_createFragment_autoTitle() {
  const core = await importWithOverride(path.join(tempDir, "autotitle.jsonl"));

  // Short fragment - title should be full text
  const shortFragment = core.createFragment("Short text", "ai", null, null);
  assert.strictEqual(shortFragment.title, "Short text", "Short text should be full title");
  assert.strictEqual(shortFragment.project, null, "Should have null project");

  // Long fragment - title should be truncated
  const longText = "This is a very long fragment that exceeds the forty character limit for auto title generation";
  const longFragment = core.createFragment(longText, "ai", null, "testproject");
  assert(longFragment.title.endsWith("..."), "Long title should end with ellipsis");
  assert.strictEqual(longFragment.title.length, 43, "Long title should be 40 chars + '...'");
  assert.strictEqual(longFragment.project, "testproject", "Should have project set");
}

// Test 14: filterByProject - correct filtering
async function test_filterByProject_correctFiltering() {
  const core = await importWithOverride(path.join(tempDir, "filter.jsonl"));
  const now = new Date().toISOString();

  const fragments = [
    { id: "m001", fragment: "Global 1", project: null, confidence: 1.0, created: now, lastAccessed: now },
    { id: "m002", fragment: "Global 2", project: undefined, confidence: 1.0, created: now, lastAccessed: now },
    { id: "m003", fragment: "Project A", project: "projectA", confidence: 1.0, created: now, lastAccessed: now },
    { id: "m004", fragment: "Project B", project: "projectB", confidence: 1.0, created: now, lastAccessed: now },
  ];

  // Filter for projectA - should get global + projectA
  const filteredA = core.filterByProject(fragments, "projectA");
  assert.strictEqual(filteredA.length, 3, "Should have 3 fragments for projectA");
  assert(filteredA.every(f => f.project === null || f.project === undefined || f.project === "projectA"));

  // Filter for projectB - should get global + projectB
  const filteredB = core.filterByProject(fragments, "projectB");
  assert.strictEqual(filteredB.length, 3, "Should have 3 fragments for projectB");

  // No project context - should get only global
  const filteredNone = core.filterByProject(fragments, null);
  assert.strictEqual(filteredNone.length, 2, "Should have 2 global fragments");
}

// Test 15: searchAndSortFragments - search and top-k truncating
async function test_searchAndSortFragments_searchAndSort() {
  const core = await importWithOverride(path.join(tempDir, "search.jsonl"));
  const now = new Date().toISOString();

  const fragments = [
    { id: "m001", title: "Apple", fragment: "The apple is red", confidence: 1.0, created: now, lastAccessed: now },
    { id: "m002", title: "Banana", fragment: "The banana is yellow", confidence: 1.0, created: now, lastAccessed: now },
    { id: "m003", title: "Apple 2", fragment: "A green apple", confidence: 0.8, created: now, lastAccessed: now },
    { id: "m004", title: "Orange", fragment: "Oranges are orange", confidence: 1.0, created: now, lastAccessed: now },
  ];

  // Empty search should return all via default TopK
  const allResults = core.searchAndSortFragments(fragments, null, 10);
  assert.strictEqual(allResults.length, 4, "Empty search should return all");

  // Search for apple should rank apples highest
  const appleResults = core.searchAndSortFragments(fragments, "apple", 10);
  assert.strictEqual(appleResults.length, 2, "Should find 2 apples");
  assert.strictEqual(appleResults[0].id, "m001", "Red apple has higher confidence so should be first");

  // Limit top K
  const top1Result = core.searchAndSortFragments(fragments, "apple", 1);
  assert.strictEqual(top1Result.length, 1, "Should truncate to top 1");
}

// Test 16: searchAndSortFragments - updates lastAccessed
async function test_searchAndSortFragments_updatesLastAccessed() {
  const core = await importWithOverride(path.join(tempDir, "search-accessed.jsonl"));

  const oldDate = "2026-01-01T00:00:00.000Z";
  const fragments = [
    { id: "m001", title: "Test", fragment: "Content", confidence: 1.0, created: oldDate, lastAccessed: oldDate },
  ];

  const result = core.searchAndSortFragments(fragments, null, 10);

  assert.notStrictEqual(result[0].lastAccessed, oldDate, "lastAccessed should be updated");
  assert(new Date(result[0].lastAccessed) > new Date(oldDate), "New lastAccessed should be more recent");
}

// Test 17: findSimilarFragment - similarity matching
async function test_findSimilarFragment_matching() {
  const core = await importWithOverride(path.join(tempDir, "similarity.jsonl"));
  const now = new Date().toISOString();

  const fragments = [
    { id: "m001", title: "Config", fragment: "User uses dark mode theme", project: null, confidence: 1.0, created: now, lastAccessed: now },
  ];

  // Exact match
  const exact = core.findSimilarFragment(fragments, "User uses dark mode theme", null);
  assert.strictEqual(exact.id, "m001", "Exact text should match");

  // Close match
  const close = core.findSimilarFragment(fragments, "User prefers a dark mode theme", null);
  assert.strictEqual(close.id, "m001", "Close text should match");

  // Unrelated
  const unrelated = core.findSimilarFragment(fragments, "User likes pizza", null);
  assert.strictEqual(unrelated, null, "Unrelated text should not match");
}

// Test 18: findSimilarFragment - respects project scope
async function test_findSimilarFragment_projectScope() {
  const core = await importWithOverride(path.join(tempDir, "similarity-project.jsonl"));
  const now = new Date().toISOString();

  const fragments = [
    { id: "m001", title: "Config", fragment: "User uses dark mode theme", project: null, confidence: 1.0, created: now, lastAccessed: now },
    { id: "m002", title: "Config", fragment: "User uses dark mode theme", project: "other-project", confidence: 1.0, created: now, lastAccessed: now },
  ];

  // Should find global match when searching from any project
  const matchGlobal = core.findSimilarFragment(fragments, "User uses dark mode theme", "my-project");
  assert.strictEqual(matchGlobal.id, "m001", "Should match global fragment");

  // Should not match when both are in different projects
  const matchOther = core.findSimilarFragment(fragments, "Different content entirely", "my-project");
  assert.strictEqual(matchOther, null, "Should not match fragment from different project");
}

// Test 19: detectProject - returns project name
async function test_detectProject_returnsProjectName() {
  const core = await importWithOverride(path.join(tempDir, "detect.jsonl"));

  const project = core.detectProject();

  // Should return some string (the current working directory name)
  assert(typeof project === "string", "Should return a string");
  assert(project.length > 0, "Should return non-empty string");
}

// ============================================
// SKILLS TESTS
// ============================================

// Import skills module with path override
async function importSkillsWithOverride(skillsFilePath) {
  const tempModulePath = path.join(tempDir, `skills-core-${Date.now()}.mjs`);
  const originalCode = await fs.readFile(
    path.join(__dirname, "../src/skills/core.js"),
    "utf-8"
  );

  const normalizedPath = skillsFilePath.replace(/\\/g, "/");

  // Fuse.js mock for tests
  const fuseMock = `
// Fuse.js mock for tests
class Fuse {
  constructor(items, options) {
    this.items = items;
    this.options = options;
  }
  search(query, { limit } = {}) {
    const threshold = this.options.threshold || 0.4;
    const keys = this.options.keys || [];
    const results = [];
    const queryLower = query.toLowerCase();

    for (const item of this.items) {
      let score = 1;
      let matched = false;

      for (const keyDef of keys) {
        const key = typeof keyDef === 'object' ? keyDef.name : keyDef;
        let value;
        if (key === 'keywords') {
          value = (item.keywords || []).join(' ');
        } else {
          value = (item[key] || '').toLowerCase();
        }
        if (value.toLowerCase().includes(queryLower) || queryLower.includes(value.toLowerCase())) {
          matched = true;
          break;
        }
      }

      if (matched) {
        results.push({ item, score });
        if (limit && results.length >= limit) break;
      }
    }
    return results;
  }
}
`;

  // Resolve task-map.js path for import replacement
  const taskMapPath = pathToFileURL(path.join(__dirname, "../src/skills/task-map.js")).href;

  const modifiedCode = originalCode
    .replace(/import Fuse from "fuse\.js";/, fuseMock)
    .replace(
      /import \{ TASK_SKILL_MAP \} from "\.\/task-map\.js";/,
      `import { TASK_SKILL_MAP } from "${taskMapPath}";`
    )
    .replace(
      /const SKILLS_FILE = path\.join\(MEMORY_DIR, "skills\.jsonl"\);/,
      `const SKILLS_FILE = "${normalizedPath}";`
    );

  await fs.writeFile(tempModulePath, modifiedCode);
  return import(pathToFileURL(tempModulePath).href);
}

// Test 20: generateSkillId - correct format
async function test_skills_generateSkillId() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-id.jsonl"));

  const id = skills.generateSkillId();

  assert(id.startsWith("s"), "Skill ID should start with 's'");
  assert.strictEqual(id.length, 7, "Skill ID should be 7 characters long");

  const hexPart = id.slice(1);
  assert(/^[0-9a-f]{6}$/.test(hexPart), "Last 6 chars should be hexadecimal");
}

// Test 21: createSkill creates valid object
async function test_skills_createSkill() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-create.jsonl"));
  const skill = skills.createSkill("React", "Frontend", "React library manual", ["hooks", "jsx"], ["useCallback önemli"]);

  assert.ok(skill.id.startsWith("s"), "ID should start with 's'");
  assert.strictEqual(skill.skill, "react", "Skill name should be lowercase");
  assert.strictEqual(skill.category, "frontend", "Category should be lowercase");
  assert.strictEqual(skill.usage_count, 1, "Initial usage count should be 1");
  assert.strictEqual(skill.contexts.length, 2, "Should have 2 contexts");
  assert.strictEqual(skill.learnings.length, 1, "Should have 1 learning");
}

// Test 22: createSkill - normalizes inputs
async function test_skills_createSkill_normalizesInputs() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-normalize.jsonl"));

  const skill = skills.createSkill(
    "  REACT  ",
    "  FRONTEND  ",
    "  Description  ",
    ["  HOOKS  ", "", "JSX"],
    ["  Learning  ", ""]
  );

  assert.strictEqual(skill.skill, "react", "Skill name should be trimmed and lowercase");
  assert.strictEqual(skill.category, "frontend", "Category should be trimmed and lowercase");
  assert.strictEqual(skill.description, "Description", "Description should be trimmed");
  assert.strictEqual(skill.contexts.length, 2, "Empty contexts should be filtered");
  assert.ok(skill.contexts.includes("hooks"), "Contexts should be lowercase");
}

// Test 23: practiceSkill increments usage
async function test_skills_practiceSkill() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-practice.jsonl"));
  const allSkills = [];

  // First practice creates skill
  const skill1 = skills.practiceSkill(allSkills, "React", "frontend");
  assert.strictEqual(skill1.usage_count, 1, "First practice should set usage to 1");

  // Second practice increments
  const skill2 = skills.practiceSkill(allSkills, "React", "frontend");
  assert.strictEqual(skill2.usage_count, 2, "Second practice should increment to 2");
  assert.strictEqual(allSkills.length, 1, "Should still be 1 skill");
}

// Test 24: practiceSkill merges contexts and learnings
async function test_skills_mergeContextsLearnings() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-merge.jsonl"));
  const allSkills = [];

  // Create with initial contexts/learnings
  skills.practiceSkill(allSkills, "React", "frontend", "React manual", ["hooks"], ["learning1"]);

  // Add more contexts/learnings
  const updated = skills.practiceSkill(allSkills, "React", "frontend", "", ["jsx", "hooks"], ["learning2"]);

  assert.strictEqual(updated.contexts.length, 2, "Should have 2 unique contexts");
  assert.strictEqual(updated.learnings.length, 2, "Should have 2 unique learnings");
  assert.ok(updated.contexts.includes("hooks"), "Should have hooks context");
  assert.ok(updated.contexts.includes("jsx"), "Should have jsx context");
}

// Test 25: practiceSkill - deduplicates learnings
async function test_skills_practiceSkill_deduplicatesLearnings() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-dedup.jsonl"));
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "frontend", "", [], ["useCallback prevents re-renders"]);
  skills.practiceSkill(allSkills, "React", "frontend", "", [], ["useCallback prevents re-renders"]);
  skills.practiceSkill(allSkills, "React", "frontend", "", [], ["useCallback prevents re-renders"]);

  const found = skills.findSkill(allSkills, "React");
  assert.strictEqual(found.learnings.length, 1, "Should deduplicate identical learnings");
}

// Test 26: findSkill finds by name case insensitive
async function test_skills_findSkill() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-find.jsonl"));
  const allSkills = [];
  skills.practiceSkill(allSkills, "React", "frontend");

  const found1 = skills.findSkill(allSkills, "react");
  assert.ok(found1, "Should find with lowercase");

  const found2 = skills.findSkill(allSkills, "REACT");
  assert.ok(found2, "Should find with uppercase");

  const found3 = skills.findSkill(allSkills, "Vue");
  assert.strictEqual(found3, null, "Should not find non-existent skill");
}

// Test 27: getTopSkills sorts by usage
async function test_skills_getTopSkills() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-top.jsonl"));
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "frontend");
  skills.practiceSkill(allSkills, "Vue", "frontend");
  skills.practiceSkill(allSkills, "Vue", "frontend");
  skills.practiceSkill(allSkills, "Angular", "frontend");
  skills.practiceSkill(allSkills, "Angular", "frontend");
  skills.practiceSkill(allSkills, "Angular", "frontend");

  const top = skills.getTopSkills(allSkills, 10);
  assert.strictEqual(top[0].skill, "angular", "Angular should be first (3 uses)");
  assert.strictEqual(top[1].skill, "vue", "Vue should be second (2 uses)");
  assert.strictEqual(top[2].skill, "react", "React should be third (1 use)");
}

// Test 28: getTopSkills - respects limit
async function test_skills_getTopSkills_respectsLimit() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-limit.jsonl"));
  const allSkills = [];

  for (let i = 0; i < 10; i++) {
    skills.practiceSkill(allSkills, `Skill${i}`, "frontend");
  }

  const top = skills.getTopSkills(allSkills, 3);
  assert.strictEqual(top.length, 3, "Should return only 3 skills");
}

// Test 29: getSkillsByCategory - filters correctly
async function test_skills_getSkillsByCategory() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-category.jsonl"));
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "web-frontend");
  skills.practiceSkill(allSkills, "Vue", "web-frontend");
  skills.practiceSkill(allSkills, "NodeJS", "web-backend");

  const frontend = skills.getSkillsByCategory(allSkills, "web-frontend");
  assert.strictEqual(frontend.length, 2, "Should have 2 frontend skills");

  const backend = skills.getSkillsByCategory(allSkills, "web-backend");
  assert.strictEqual(backend.length, 1, "Should have 1 backend skill");

  const none = skills.getSkillsByCategory(allSkills, "nonexistent");
  assert.strictEqual(none.length, 0, "Should return empty for nonexistent category");
}

// Test 30: updateSkill - updates fields
async function test_skills_updateSkill() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-update.jsonl"));
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "frontend", "Old description");

  const updated = skills.updateSkill(allSkills, "React", {
    skill: "ReactJS",
    category: "web-frontend",
    description: "New description"
  });

  assert.ok(updated, "Should return updated skill");
  assert.strictEqual(updated.skill, "reactjs", "Should update skill name");
  assert.strictEqual(updated.category, "web-frontend", "Should update category");
  assert.strictEqual(updated.description, "New description", "Should update description");
}

// Test 31: updateSkill - returns null for non-existent
async function test_skills_updateSkill_notFound() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-update-notfound.jsonl"));
  const allSkills = [];

  const result = skills.updateSkill(allSkills, "NonExistent", { description: "test" });
  assert.strictEqual(result, null, "Should return null for non-existent skill");
}

// Test 32: deleteSkill - removes skill
async function test_skills_deleteSkill() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-delete.jsonl"));
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "frontend");
  skills.practiceSkill(allSkills, "Vue", "frontend");

  const result = skills.deleteSkill(allSkills, "React");

  assert.strictEqual(result, true, "Should return true when deleted");
  assert.strictEqual(allSkills.length, 1, "Should have 1 skill remaining");
  assert.strictEqual(allSkills[0].skill, "vue", "Vue should remain");
}

// Test 33: deleteSkill - returns false for non-existent
async function test_skills_deleteSkill_notFound() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-delete-notfound.jsonl"));
  const allSkills = [];

  const result = skills.deleteSkill(allSkills, "NonExistent");
  assert.strictEqual(result, false, "Should return false for non-existent skill");
}

// Test 34: promoteToSkill - creates new skill from memory
async function test_skills_promoteToSkill_createsNew() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-promote.jsonl"));
  const allSkills = [];

  const result = skills.promoteToSkill(allSkills, "React", "web-frontend", "useCallback prevents re-renders", "hooks");

  assert.ok(result, "Should return the skill");
  assert.strictEqual(result.skill, "react", "Should have correct skill name");
  assert.strictEqual(result.learnings.length, 1, "Should have 1 learning");
  assert.ok(result.learnings.includes("useCallback prevents re-renders"), "Should have the learning");
  assert.ok(result.contexts.includes("hooks"), "Should have the context");
}

// Test 35: promoteToSkill - adds to existing skill
async function test_skills_promoteToSkill_addsToExisting() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-promote-add.jsonl"));
  const allSkills = [];

  // Create initial skill
  skills.practiceSkill(allSkills, "React", "frontend", "Manual", ["hooks"], ["Initial learning"]);

  // Promote new knowledge
  skills.promoteToSkill(allSkills, "React", "frontend", "New learning from memory", "jsx");

  const found = skills.findSkill(allSkills, "React");
  assert.strictEqual(found.learnings.length, 2, "Should have 2 learnings");
  assert.ok(found.learnings.includes("New learning from memory"), "Should have new learning");
  assert.ok(found.contexts.includes("jsx"), "Should have new context");
}

// Test 36: promoteToSkill - deduplicates learnings
async function test_skills_promoteToSkill_deduplicates() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-promote-dedup.jsonl"));
  const allSkills = [];

  // Create initial skill
  skills.practiceSkill(allSkills, "React", "frontend", "", [], ["Same learning"]);

  // Try to promote same learning
  skills.promoteToSkill(allSkills, "React", "frontend", "Same learning", "");

  const found = skills.findSkill(allSkills, "React");
  assert.strictEqual(found.learnings.length, 1, "Should not duplicate learning");
}

// Test 37: loadSkills - empty file
async function test_skills_loadSkills_emptyFile() {
  const skillsFile = path.join(tempDir, "skills-empty.jsonl");
  await fs.writeFile(skillsFile, "");

  const skills = await importSkillsWithOverride(skillsFile);
  const result = skills.loadSkills();

  assert.deepStrictEqual(result, [], "Empty file should return empty array");
}

// Test 38: loadSkills - with skills
async function test_skills_loadSkills_withSkills() {
  const skillsFile = path.join(tempDir, "skills-load.jsonl");

  const skill1 = {
    id: "s123abc",
    skill: "react",
    category: "frontend",
    usage_count: 5,
    last_used: "2026-03-01",
    contexts: ["hooks"],
    learnings: ["test"]
  };

  await fs.writeFile(skillsFile, JSON.stringify(skill1) + "\n");

  const skills = await importSkillsWithOverride(skillsFile);
  const result = skills.loadSkills();

  assert.strictEqual(result.length, 1, "Should load 1 skill");
  assert.strictEqual(result[0].skill, "react", "Should have correct skill");
}

// Test 39: saveSkills - persists to disk
async function test_skills_saveSkills_persists() {
  const skillsFile = path.join(tempDir, "skills-save.jsonl");

  const skills = await importSkillsWithOverride(skillsFile);
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "frontend", "Manual", ["hooks"], ["Learning"]);
  skills.saveSkills(allSkills);

  const content = await fs.readFile(skillsFile, "utf-8");
  assert(content.includes("react"), "File should contain skill");
  assert(content.includes("frontend"), "File should contain category");
}

// Test 40: formatSkillsForLLM - correct format
async function test_skills_formatSkillsForLLM() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-format.jsonl"));
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "web-frontend", "React manual", ["hooks", "jsx"], ["Learning 1", "Learning 2"]);

  const formatted = skills.formatSkillsForLLM(allSkills);

  assert(formatted.includes("=== LEMMA SKILLS ==="), "Should include header");
  assert(formatted.includes("react"), "Should include skill name");
  assert(formatted.includes("web-frontend"), "Should include category");
  assert(formatted.includes("(2 learnings)"), "Should include learning count");
}

// Test 41: formatSkillsForLLM - empty skills
async function test_skills_formatSkillsForLLM_empty() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-format-empty.jsonl"));

  const formatted = skills.formatSkillsForLLM([]);

  assert(formatted.includes("=== LEMMA SKILLS ==="), "Should include header");
  assert(formatted.includes("(no skills tracked yet)"), "Should indicate no skills");
}

// Test 42: formatSkillDetail - correct format
async function test_skills_formatSkillDetail() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-detail.jsonl"));

  const skill = {
    id: "s123",
    skill: "react",
    category: "web-frontend",
    usage_count: 10,
    last_used: "2026-03-01",
    description: "React is a JavaScript library",
    contexts: ["hooks", "jsx"],
    learnings: ["useCallback prevents re-renders", "useState for local state"]
  };

  const formatted = skills.formatSkillDetail(skill);

  assert(formatted.includes("=== SKILL: react ==="), "Should include skill header");
  assert(formatted.includes("Category: web-frontend"), "Should include category");
  assert(formatted.includes("Usage Count: 10"), "Should include usage count");
  assert(formatted.includes("React is a JavaScript library"), "Should include description");
  assert(formatted.includes("useCallback prevents re-renders"), "Should include learnings");
}

// Test 43: formatSkillDetail - null skill
async function test_skills_formatSkillDetail_null() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-detail-null.jsonl"));

  const formatted = skills.formatSkillDetail(null);

  assert(formatted.includes("Skill not found"), "Should indicate skill not found");
}

// Test 44: suggestSkills - finds relevant skills
async function test_skills_suggestSkills_findsRelevant() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-suggest.jsonl"));
  const allSkills = [];

  skills.practiceSkill(allSkills, "React", "web-frontend", "React library", ["hooks", "jsx"], ["useCallback is important"]);

  const result = skills.suggestSkills("react hooks component", allSkills);

  assert.ok(result.suggested.length > 0, "Should find suggestions");
  assert.ok(result.summary.includes("relevant skills"), "Should include summary");
}

// Test 45: suggestSkills - returns tracked and missing
async function test_skills_suggestSkills_separatesTrackedAndMissing() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-suggest-sep.jsonl"));
  const allSkills = [];

  // Only React is tracked
  skills.practiceSkill(allSkills, "React", "web-frontend", "", [], []);

  const result = skills.suggestSkills("react and vue components", allSkills);

  // React should be tracked
  const trackedReact = result.relevant.find(s => s.skill === "react");
  assert.ok(trackedReact, "React should be in tracked/relevant");
  assert.strictEqual(trackedReact.tracked, true, "React should be marked as tracked");
}

// Test 46: formatSuggestions - correct format
async function test_skills_formatSuggestions() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-format-suggest.jsonl"));

  const result = {
    summary: "Found 2 relevant skills (1 tracked, 1 new)",
    relevant: [
      { skill: "react", category: "web-frontend", usage_count: 5, last_used: "2026-03-01", learnings: ["test learning"] }
    ],
    missing: [
      { skill: "vue", category: "web-frontend", keywords: ["vue", "component"] }
    ],
    suggested: []
  };

  const formatted = skills.formatSuggestions(result);

  assert(formatted.includes("=== SKILL SUGGESTIONS ==="), "Should include header");
  assert(formatted.includes("TRACKED"), "Should include tracked section");
  assert(formatted.includes("SUGGESTED"), "Should include suggested section");
  assert(formatted.includes("react"), "Should include skill name");
  assert(formatted.includes("test learning"), "Should include learning");
}

// Test 47: formatSuggestions - empty results
async function test_skills_formatSuggestions_empty() {
  const skills = await importSkillsWithOverride(path.join(tempDir, "skills-format-suggest-empty.jsonl"));

  const result = {
    summary: "Found 0 relevant skills (0 tracked, 0 new)",
    relevant: [],
    missing: [],
    suggested: []
  };

  const formatted = skills.formatSuggestions(result);

  assert(formatted.includes("No relevant skills found"), "Should indicate no results");
}

// Setup and teardown
async function setup() {
  tempDir = path.join(os.tmpdir(), `lemma-test-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
}

async function teardown() {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

// Main test runner
async function runTests() {
  console.log("Setting up test environment...");
  await setup();

  console.log("\n" + "=".repeat(60));
  console.log("Running Lemma Memory & Skills System Tests");
  console.log("=".repeat(60) + "\n");

  console.log("--- MEMORY TESTS ---\n");
  await runTest("loadMemory - empty file", test_loadMemory_emptyFile);
  await runTest("loadMemory - with fragments", test_loadMemory_withFragments);
  await runTest("saveMemory - creates directory", test_saveMemory_createsDirectory);
  await runTest("decayConfidence - reduces correctly", test_decayConfidence_reducesCorrectly);
  await runTest("decayConfidence - removes low fragments", test_decayConfidence_removesLowFragments);
  await runTest("decayConfidence - time decay multiplier", test_decayConfidence_timeDecayMultiplier);
  await runTest("decayConfidence - resets accessed counter", test_decayConfidence_resetsAccessedCounter);
  await runTest("formatMemoryForLLM - correct format", test_formatMemoryForLLM_correctFormat);
  await runTest("formatMemoryForLLM - empty fragments", test_formatMemoryForLLM_emptyFragments);
  await runTest("formatMemoryForLLM - with project header", test_formatMemoryForLLM_withProject);
  await runTest("generateId - correct format", test_generateId_correctFormat);
  await runTest("createFragment - valid object", test_createFragment_validObject);
  await runTest("createFragment - auto title generation", test_createFragment_autoTitle);
  await runTest("filterByProject - correct filtering", test_filterByProject_correctFiltering);
  await runTest("searchAndSortFragments - search and sort", test_searchAndSortFragments_searchAndSort);
  await runTest("searchAndSortFragments - updates lastAccessed", test_searchAndSortFragments_updatesLastAccessed);
  await runTest("findSimilarFragment - matching", test_findSimilarFragment_matching);
  await runTest("findSimilarFragment - project scope", test_findSimilarFragment_projectScope);
  await runTest("detectProject - returns project name", test_detectProject_returnsProjectName);

  console.log("\n--- SKILLS TESTS ---\n");
  await runTest("generateSkillId - correct format", test_skills_generateSkillId);
  await runTest("createSkill - creates valid object", test_skills_createSkill);
  await runTest("createSkill - normalizes inputs", test_skills_createSkill_normalizesInputs);
  await runTest("practiceSkill - increments usage", test_skills_practiceSkill);
  await runTest("practiceSkill - merges contexts and learnings", test_skills_mergeContextsLearnings);
  await runTest("practiceSkill - deduplicates learnings", test_skills_practiceSkill_deduplicatesLearnings);
  await runTest("findSkill - case insensitive", test_skills_findSkill);
  await runTest("getTopSkills - sorts by usage", test_skills_getTopSkills);
  await runTest("getTopSkills - respects limit", test_skills_getTopSkills_respectsLimit);
  await runTest("getSkillsByCategory - filters correctly", test_skills_getSkillsByCategory);
  await runTest("updateSkill - updates fields", test_skills_updateSkill);
  await runTest("updateSkill - returns null for non-existent", test_skills_updateSkill_notFound);
  await runTest("deleteSkill - removes skill", test_skills_deleteSkill);
  await runTest("deleteSkill - returns false for non-existent", test_skills_deleteSkill_notFound);
  await runTest("promoteToSkill - creates new skill", test_skills_promoteToSkill_createsNew);
  await runTest("promoteToSkill - adds to existing", test_skills_promoteToSkill_addsToExisting);
  await runTest("promoteToSkill - deduplicates learnings", test_skills_promoteToSkill_deduplicates);
  await runTest("loadSkills - empty file", test_skills_loadSkills_emptyFile);
  await runTest("loadSkills - with skills", test_skills_loadSkills_withSkills);
  await runTest("saveSkills - persists to disk", test_skills_saveSkills_persists);
  await runTest("formatSkillsForLLM - correct format", test_skills_formatSkillsForLLM);
  await runTest("formatSkillsForLLM - empty skills", test_skills_formatSkillsForLLM_empty);
  await runTest("formatSkillDetail - correct format", test_skills_formatSkillDetail);
  await runTest("formatSkillDetail - null skill", test_skills_formatSkillDetail_null);
  await runTest("suggestSkills - finds relevant", test_skills_suggestSkills_findsRelevant);
  await runTest("suggestSkills - separates tracked and missing", test_skills_suggestSkills_separatesTrackedAndMissing);
  await runTest("formatSuggestions - correct format", test_skills_formatSuggestions);
  await runTest("formatSuggestions - empty results", test_skills_formatSuggestions_empty);

  console.log("\n" + "=".repeat(60));
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log(`Total tests:  ${passed + failed}`);
  console.log("=".repeat(60));

  await teardown();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
