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
      description: "Short summary of important fact",
      fragment: "This is the detailed content of important fact that is very long and should not appear in summary mode",
      confidence: 1.0,
      source: "ai",
      created: "2026-03-01",
      accessed: 0,
    },
    {
      id: "m789xyz",
      title: "Another fact",
      description: "Summary of another fact",
      fragment: "This is another detailed fact content that is also very long",
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
  assert(formatted.includes("Short summary of important fact"), "Should include description (not full fragment)");
  assert(!formatted.includes("very long and should not appear"), "Should NOT include full fragment content");
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
  assert(fragment.description, "Should have auto-generated description");
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
  assert.strictEqual(shortFragment.description, "Short text", "Short description should be full text");

  // Long fragment - title should be truncated
  const longText = "This is a very long fragment that exceeds the forty character limit for auto title generation";
  const longFragment = core.createFragment(longText, "ai", null, "testproject");
  assert(longFragment.title.endsWith("..."), "Long title should end with ellipsis");
  assert.strictEqual(longFragment.title.length, 43, "Long title should be 40 chars + '...'");
  assert.strictEqual(longFragment.project, "testproject", "Should have project set");
  assert(longFragment.description, "Should have auto-generated description");
  assert(longFragment.description.length <= 120, "Description should be max 120 chars");
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

  // Filter for projectA - should get ONLY projectA (STRICT ISOLATION)
  const filteredA = core.filterByProject(fragments, "projectA");
  assert.strictEqual(filteredA.length, 1, "Should have 1 fragment for projectA (strict isolation)");
  assert.strictEqual(filteredA[0].project, "projectA", "Should only contain projectA fragments");

  // Filter for projectB - should get ONLY projectB (STRICT ISOLATION)
  const filteredB = core.filterByProject(fragments, "projectB");
  assert.strictEqual(filteredB.length, 1, "Should have 1 fragment for projectB (strict isolation)");
  assert.strictEqual(filteredB[0].project, "projectB", "Should only contain projectB fragments");

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
    { id: "m002", title: "Config", fragment: "User uses dark mode theme", project: "my-project", confidence: 1.0, created: now, lastAccessed: now },
    { id: "m003", title: "Config", fragment: "User uses dark mode theme", project: "other-project", confidence: 1.0, created: now, lastAccessed: now },
  ];

  // STRICT ISOLATION: Should find ONLY same-project match (not global)
  const matchProject = core.findSimilarFragment(fragments, "User uses dark mode theme", "my-project");
  assert.strictEqual(matchProject.id, "m002", "Should match same-project fragment (not global)");

  // Should find global when searching with no project context
  const matchGlobal = core.findSimilarFragment(fragments, "User uses dark mode theme", null);
  assert.strictEqual(matchGlobal.id, "m001", "Should match global fragment when no project context");

  // Should not match when in different project (strict isolation)
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
// GUIDES TESTS
// ============================================

// Test: createFragment - explicit description
async function test_createFragment_explicitDescription() {
  const core = await importWithOverride(path.join(tempDir, "create-desc.jsonl"));

  const fragment = core.createFragment("Long content here that goes on and on", "ai", "Title", "proj", "Custom description");
  assert.strictEqual(fragment.description, "Custom description", "Should use explicit description");

  const autoDesc = core.createFragment("Long content here that goes on and on", "ai", "Title", "proj");
  assert(autoDesc.description, "Should auto-generate description when not provided");
}

// Test: createFragment - description generation for short vs long text
async function test_createFragment_descriptionGeneration() {
  const core = await importWithOverride(path.join(tempDir, "create-desc-gen.jsonl"));

  // Very short text: description should be the text itself
  const short = core.createFragment("Brief note", "ai");
  assert.strictEqual(short.description, "Brief note", "Short text should be used as description directly");

  // Long text: description should be truncated/summarized
  const longText = "This is a very long memory fragment that contains a lot of detailed information about various topics and should be summarized for the preview mode. The full content is much longer than what the description should show.";
  const long = core.createFragment(longText, "ai");
  assert(long.description.length <= 120, "Long description should be max 120 chars");
  assert(!long.description.includes("should be summarized for the preview mode"), "Should not include later parts of long text");
}

// Test: formatMemoryDetail - shows full content
async function test_formatMemoryDetail_fullContent() {
  const core = await importWithOverride(path.join(tempDir, "format-detail.jsonl"));

  const fragment = {
    id: "m123abc",
    title: "Test Memory",
    description: "Short summary",
    fragment: "This is the full detailed content that should appear in detail view",
    confidence: 0.8,
    source: "ai",
    project: "testproj",
    created: "2026-03-01T10:00:00.000Z",
    accessed: 3,
  };

  const detail = core.formatMemoryDetail(fragment);

  assert(detail.includes("=== MEMORY FRAGMENT DETAIL ==="), "Should include detail header");
  assert(detail.includes("m123abc"), "Should include ID");
  assert(detail.includes("Test Memory"), "Should include title");
  assert(detail.includes("Short summary"), "Should include summary");
  assert(detail.includes("This is the full detailed content"), "Should include FULL fragment content");
  assert(detail.includes("[testproj]"), "Should include project scope");
  assert(detail.includes("0.80"), "Should include confidence value");
}

// Test: formatMemoryDetail - null fragment
async function test_formatMemoryDetail_null() {
  const core = await importWithOverride(path.join(tempDir, "format-detail-null.jsonl"));

  const detail = core.formatMemoryDetail(null);
  assert(detail.includes("Fragment not found"), "Should indicate fragment not found");
}

// Test: formatMemoryDetail - global scope
async function test_formatMemoryDetail_globalScope() {
  const core = await importWithOverride(path.join(tempDir, "format-detail-global.jsonl"));

  const fragment = {
    id: "m999",
    title: "Global Memory",
    description: "A global note",
    fragment: "Global content here",
    confidence: 1.0,
    source: "user",
    project: null,
    created: "2026-03-01",
    accessed: 0,
  };

  const detail = core.formatMemoryDetail(fragment);
  assert(detail.includes("[global]"), "Should show [global] for null project");
  assert(detail.includes("👤"), "Should show user icon");
}

// Test: filterByProject - normalizes empty/whitespace strings
async function test_filterByProject_normalizesEmptyStrings() {
  const core = await importWithOverride(path.join(tempDir, "filter-normalize.jsonl"));
  const now = new Date().toISOString();

  const fragments = [
    { id: "m001", fragment: "Global", project: null, confidence: 1.0, created: now, lastAccessed: now },
    { id: "m002", fragment: "Project A", project: "projectA", confidence: 1.0, created: now, lastAccessed: now },
  ];

  // Empty string should behave like null (return only global)
  const emptyStr = core.filterByProject(fragments, "");
  assert.strictEqual(emptyStr.length, 1, "Empty string should return only global fragments");
  assert.strictEqual(emptyStr[0].id, "m001", "Should return global fragment");

  // Whitespace-only string should behave like null
  const whitespace = core.filterByProject(fragments, "   ");
  assert.strictEqual(whitespace.length, 1, "Whitespace should return only global fragments");
}

// Import guides module with path override
async function importGuidesWithOverride(guidesFilePath) {
  const tempModulePath = path.join(tempDir, `guides-core-${Date.now()}.mjs`);
  const originalCode = await fs.readFile(
    path.join(__dirname, "../src/guides/core.js"),
    "utf-8"
  );

  const normalizedPath = guidesFilePath.replace(/\\/g, "/");

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
  const taskMapPath = pathToFileURL(path.join(__dirname, "../src/guides/task-map.js")).href;

  const modifiedCode = originalCode
    .replace(/import Fuse from "fuse\.js";/, fuseMock)
    .replace(
      /import \{ TASK_GUIDE_MAP \} from "\.\/task-map\.js";/,
      `import { TASK_GUIDE_MAP } from "${taskMapPath}";`
    )
    .replace(
      /const GUIDES_FILE = path\.join\(MEMORY_DIR, "guides\.jsonl"\);/,
      `const GUIDES_FILE = "${normalizedPath}";`
    );

  await fs.writeFile(tempModulePath, modifiedCode);
  return import(pathToFileURL(tempModulePath).href);
}

// Test 20: generateGuideId - correct format
async function test_guides_generateGuideId() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-id.jsonl"));

  const id = guides.generateGuideId();

  assert(id.startsWith("g"), "Guide ID should start with 'g'");
  assert.strictEqual(id.length, 7, "Guide ID should be 7 characters long");

  const hexPart = id.slice(1);
  assert(/^[0-9a-f]{6}$/.test(hexPart), "Last 6 chars should be hexadecimal");
}

// Test 21: createGuide creates valid object
async function test_guides_createGuide() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-create.jsonl"));
  const guide = guides.createGuide("React", "Frontend", "React library manual", ["hooks", "jsx"], ["useCallback önemli"]);

  assert.ok(guide.id.startsWith("g"), "ID should start with 'g'");
  assert.strictEqual(guide.guide, "react", "Guide name should be lowercase");
  assert.strictEqual(guide.category, "frontend", "Category should be lowercase");
  assert.strictEqual(guide.usage_count, 1, "Initial usage count should be 1");
  assert.strictEqual(guide.contexts.length, 2, "Should have 2 contexts");
  assert.strictEqual(guide.learnings.length, 1, "Should have 1 learning");
}

// Test 22: createGuide - normalizes inputs
async function test_guides_createGuide_normalizesInputs() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-normalize.jsonl"));

  const guide = guides.createGuide(
    "  REACT  ",
    "  FRONTEND  ",
    "  Description  ",
    ["  HOOKS  ", "", "JSX"],
    ["  Learning  ", ""]
  );

  assert.strictEqual(guide.guide, "react", "Guide name should be trimmed and lowercase");
  assert.strictEqual(guide.category, "frontend", "Category should be trimmed and lowercase");
  assert.strictEqual(guide.description, "Description", "Description should be trimmed");
  assert.strictEqual(guide.contexts.length, 2, "Empty contexts should be filtered");
  assert.ok(guide.contexts.includes("hooks"), "Contexts should be lowercase");
}

// Test 23: practiceGuide increments usage
async function test_guides_practiceGuide() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-practice.jsonl"));
  const allGuides = [];

  // First practice creates guide
  const guide1 = guides.practiceGuide(allGuides, "React", "frontend");
  assert.strictEqual(guide1.usage_count, 1, "First practice should set usage to 1");

  // Second practice increments
  const guide2 = guides.practiceGuide(allGuides, "React", "frontend");
  assert.strictEqual(guide2.usage_count, 2, "Second practice should increment to 2");
  assert.strictEqual(allGuides.length, 1, "Should still be 1 guide");
}

// Test 24: practiceGuide merges contexts and learnings
async function test_guides_mergeContextsLearnings() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-merge.jsonl"));
  const allGuides = [];

  // Create with initial contexts/learnings
  guides.practiceGuide(allGuides, "React", "frontend", "React manual", ["hooks"], ["learning1"]);

  // Add more contexts/learnings
  const updated = guides.practiceGuide(allGuides, "React", "frontend", "", ["jsx", "hooks"], ["learning2"]);

  assert.strictEqual(updated.contexts.length, 2, "Should have 2 unique contexts");
  assert.strictEqual(updated.learnings.length, 2, "Should have 2 unique learnings");
  assert.ok(updated.contexts.includes("hooks"), "Should have hooks context");
  assert.ok(updated.contexts.includes("jsx"), "Should have jsx context");
}

// Test 25: practiceGuide - deduplicates learnings
async function test_guides_practiceGuide_deduplicatesLearnings() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-dedup.jsonl"));
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "frontend", "", [], ["useCallback prevents re-renders"]);
  guides.practiceGuide(allGuides, "React", "frontend", "", [], ["useCallback prevents re-renders"]);
  guides.practiceGuide(allGuides, "React", "frontend", "", [], ["useCallback prevents re-renders"]);

  const found = guides.findGuide(allGuides, "React");
  assert.strictEqual(found.learnings.length, 1, "Should deduplicate identical learnings");
}

// Test 26: findGuide finds by name case insensitive
async function test_guides_findGuide() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-find.jsonl"));
  const allGuides = [];
  guides.practiceGuide(allGuides, "React", "frontend");

  const found1 = guides.findGuide(allGuides, "react");
  assert.ok(found1, "Should find with lowercase");

  const found2 = guides.findGuide(allGuides, "REACT");
  assert.ok(found2, "Should find with uppercase");

  const found3 = guides.findGuide(allGuides, "Vue");
  assert.strictEqual(found3, null, "Should not find non-existent guide");
}

// Test 27: getTopGuides sorts by usage
async function test_guides_getTopGuides() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-top.jsonl"));
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "frontend");
  guides.practiceGuide(allGuides, "Vue", "frontend");
  guides.practiceGuide(allGuides, "Vue", "frontend");
  guides.practiceGuide(allGuides, "Angular", "frontend");
  guides.practiceGuide(allGuides, "Angular", "frontend");
  guides.practiceGuide(allGuides, "Angular", "frontend");

  const top = guides.getTopGuides(allGuides, 10);
  assert.strictEqual(top[0].guide, "angular", "Angular should be first (3 uses)");
  assert.strictEqual(top[1].guide, "vue", "Vue should be second (2 uses)");
  assert.strictEqual(top[2].guide, "react", "React should be third (1 use)");
}

// Test 28: getTopGuides - respects limit
async function test_guides_getTopGuides_respectsLimit() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-limit.jsonl"));
  const allGuides = [];

  for (let i = 0; i < 10; i++) {
    guides.practiceGuide(allGuides, `Guide${i}`, "frontend");
  }

  const top = guides.getTopGuides(allGuides, 3);
  assert.strictEqual(top.length, 3, "Should return only 3 guides");
}

// Test 29: getGuidesByCategory - filters correctly
async function test_guides_getGuidesByCategory() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-category.jsonl"));
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "web-frontend");
  guides.practiceGuide(allGuides, "Vue", "web-frontend");
  guides.practiceGuide(allGuides, "NodeJS", "web-backend");

  const frontend = guides.getGuidesByCategory(allGuides, "web-frontend");
  assert.strictEqual(frontend.length, 2, "Should have 2 frontend guides");

  const backend = guides.getGuidesByCategory(allGuides, "web-backend");
  assert.strictEqual(backend.length, 1, "Should have 1 backend guide");

  const none = guides.getGuidesByCategory(allGuides, "nonexistent");
  assert.strictEqual(none.length, 0, "Should return empty for nonexistent category");
}

// Test 30: updateGuide - updates fields
async function test_guides_updateGuide() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-update.jsonl"));
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "frontend", "Old description");

  const updated = guides.updateGuide(allGuides, "React", {
    guide: "ReactJS",
    category: "web-frontend",
    description: "New description"
  });

  assert.ok(updated, "Should return updated guide");
  assert.strictEqual(updated.guide, "reactjs", "Should update guide name");
  assert.strictEqual(updated.category, "web-frontend", "Should update category");
  assert.strictEqual(updated.description, "New description", "Should update description");
}

// Test 31: updateGuide - returns null for non-existent
async function test_guides_updateGuide_notFound() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-update-notfound.jsonl"));
  const allGuides = [];

  const result = guides.updateGuide(allGuides, "NonExistent", { description: "test" });
  assert.strictEqual(result, null, "Should return null for non-existent guide");
}

// Test 32: deleteGuide - removes guide
async function test_guides_deleteGuide() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-delete.jsonl"));
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "frontend");
  guides.practiceGuide(allGuides, "Vue", "frontend");

  const result = guides.deleteGuide(allGuides, "React");

  assert.strictEqual(result, true, "Should return true when deleted");
  assert.strictEqual(allGuides.length, 1, "Should have 1 guide remaining");
  assert.strictEqual(allGuides[0].guide, "vue", "Vue should remain");
}

// Test 33: deleteGuide - returns false for non-existent
async function test_guides_deleteGuide_notFound() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-delete-notfound.jsonl"));
  const allGuides = [];

  const result = guides.deleteGuide(allGuides, "NonExistent");
  assert.strictEqual(result, false, "Should return false for non-existent guide");
}

// Test 34: promoteToGuide - creates new guide from memory
async function test_guides_promoteToGuide_createsNew() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-promote.jsonl"));
  const allGuides = [];

  const result = guides.promoteToGuide(allGuides, "React", "web-frontend", "useCallback prevents re-renders", "hooks");

  assert.ok(result, "Should return the guide");
  assert.strictEqual(result.guide, "react", "Should have correct guide name");
  assert.strictEqual(result.learnings.length, 1, "Should have 1 learning");
  assert.ok(result.learnings.includes("useCallback prevents re-renders"), "Should have the learning");
  assert.ok(result.contexts.includes("hooks"), "Should have the context");
}

// Test 35: promoteToGuide - adds to existing guide
async function test_guides_promoteToGuide_addsToExisting() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-promote-add.jsonl"));
  const allGuides = [];

  // Create initial guide
  guides.practiceGuide(allGuides, "React", "frontend", "Manual", ["hooks"], ["Initial learning"]);

  // Promote new knowledge
  guides.promoteToGuide(allGuides, "React", "frontend", "New learning from memory", "jsx");

  const found = guides.findGuide(allGuides, "React");
  assert.strictEqual(found.learnings.length, 2, "Should have 2 learnings");
  assert.ok(found.learnings.includes("New learning from memory"), "Should have new learning");
  assert.ok(found.contexts.includes("jsx"), "Should have new context");
}

// Test 36: promoteToGuide - deduplicates learnings
async function test_guides_promoteToGuide_deduplicates() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-promote-dedup.jsonl"));
  const allGuides = [];

  // Create initial guide
  guides.practiceGuide(allGuides, "React", "frontend", "", [], ["Same learning"]);

  // Try to promote same learning
  guides.promoteToGuide(allGuides, "React", "frontend", "Same learning", "");

  const found = guides.findGuide(allGuides, "React");
  assert.strictEqual(found.learnings.length, 1, "Should not duplicate learning");
}

// Test 37: loadGuides - empty file
async function test_guides_loadGuides_emptyFile() {
  const guidesFile = path.join(tempDir, "guides-empty.jsonl");
  await fs.writeFile(guidesFile, "");

  const guides = await importGuidesWithOverride(guidesFile);
  const result = guides.loadGuides();

  assert.deepStrictEqual(result, [], "Empty file should return empty array");
}

// Test 38: loadGuides - with guides
async function test_guides_loadGuides_withGuides() {
  const guidesFile = path.join(tempDir, "guides-load.jsonl");

  const guide1 = {
    id: "g123abc",
    guide: "react",
    category: "frontend",
    usage_count: 5,
    last_used: "2026-03-01",
    contexts: ["hooks"],
    learnings: ["test"]
  };

  await fs.writeFile(guidesFile, JSON.stringify(guide1) + "\n");

  const guides = await importGuidesWithOverride(guidesFile);
  const result = guides.loadGuides();

  assert.strictEqual(result.length, 1, "Should load 1 guide");
  assert.strictEqual(result[0].guide, "react", "Should have correct guide");
}

// Test 39: saveGuides - persists to disk
async function test_guides_saveGuides_persists() {
  const guidesFile = path.join(tempDir, "guides-save.jsonl");

  const guides = await importGuidesWithOverride(guidesFile);
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "frontend", "Manual", ["hooks"], ["Learning"]);
  guides.saveGuides(allGuides);

  const content = await fs.readFile(guidesFile, "utf-8");
  assert(content.includes("react"), "File should contain guide");
  assert(content.includes("frontend"), "File should contain category");
}

// Test 40: formatGuidesForLLM - correct format
async function test_guides_formatGuidesForLLM() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-format.jsonl"));
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "web-frontend", "React manual", ["hooks", "jsx"], ["Learning 1", "Learning 2"]);

  const formatted = guides.formatGuidesForLLM(allGuides);

  assert(formatted.includes("=== LEMMA GUIDES ==="), "Should include header");
  assert(formatted.includes("react"), "Should include guide name");
  assert(formatted.includes("web-frontend"), "Should include category");
  assert(formatted.includes("(2 learnings)"), "Should include learning count");
}

// Test 41: formatGuidesForLLM - empty guides
async function test_guides_formatGuidesForLLM_empty() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-format-empty.jsonl"));

  const formatted = guides.formatGuidesForLLM([]);

  assert(formatted.includes("=== LEMMA GUIDES ==="), "Should include header");
  assert(formatted.includes("(no guides tracked yet)"), "Should indicate no guides");
}

// Test 42: formatGuideDetail - correct format
async function test_guides_formatGuideDetail() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-detail.jsonl"));

  const guide = {
    id: "g123",
    guide: "react",
    category: "web-frontend",
    usage_count: 10,
    last_used: "2026-03-01",
    description: "React is a JavaScript library",
    contexts: ["hooks", "jsx"],
    learnings: ["useCallback prevents re-renders", "useState for local state"]
  };

  const formatted = guides.formatGuideDetail(guide);

  assert(formatted.includes("=== GUIDE: react ==="), "Should include guide header");
  assert(formatted.includes("Category: web-frontend"), "Should include category");
  assert(formatted.includes("Usage Count: 10"), "Should include usage count");
  assert(formatted.includes("React is a JavaScript library"), "Should include description");
  assert(formatted.includes("useCallback prevents re-renders"), "Should include learnings");
}

// Test 43: formatGuideDetail - null guide
async function test_guides_formatGuideDetail_null() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-detail-null.jsonl"));

  const formatted = guides.formatGuideDetail(null);

  assert(formatted.includes("Guide not found"), "Should indicate guide not found");
}

// Test 44: suggestGuides - finds relevant guides
async function test_guides_suggestGuides_findsRelevant() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-suggest.jsonl"));
  const allGuides = [];

  guides.practiceGuide(allGuides, "React", "web-frontend", "React library", ["hooks", "jsx"], ["useCallback is important"]);

  const result = guides.suggestGuides("react hooks component", allGuides);

  assert.ok(result.suggested.length > 0, "Should find suggestions");
  assert.ok(result.summary.includes("relevant guides"), "Should include summary");
}

// Test 45: suggestGuides - returns tracked and missing
async function test_guides_suggestGuides_separatesTrackedAndMissing() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-suggest-sep.jsonl"));
  const allGuides = [];

  // Only React is tracked
  guides.practiceGuide(allGuides, "React", "web-frontend", "", [], []);

  const result = guides.suggestGuides("react and vue components", allGuides);

  // React should be tracked
  const trackedReact = result.relevant.find(s => s.guide === "react");
  assert.ok(trackedReact, "React should be in tracked/relevant");
  assert.strictEqual(trackedReact.tracked, true, "React should be marked as tracked");
}

// Test 46: formatSuggestions - correct format
async function test_guides_formatSuggestions() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-format-suggest.jsonl"));

  const result = {
    summary: "Found 2 relevant guides (1 tracked, 1 new)",
    relevant: [
      { guide: "react", category: "web-frontend", usage_count: 5, last_used: "2026-03-01", learnings: ["test learning"] }
    ],
    missing: [
      { guide: "vue", category: "web-frontend", keywords: ["vue", "component"] }
    ],
    suggested: []
  };

  const formatted = guides.formatSuggestions(result);

  assert(formatted.includes("=== GUIDE SUGGESTIONS ==="), "Should include header");
  assert(formatted.includes("TRACKED"), "Should include tracked section");
  assert(formatted.includes("SUGGESTED"), "Should include suggested section");
  assert(formatted.includes("react"), "Should include guide name");
  assert(formatted.includes("test learning"), "Should include learning");
}

// Test 47: formatSuggestions - empty results
async function test_guides_formatSuggestions_empty() {
  const guides = await importGuidesWithOverride(path.join(tempDir, "guides-format-suggest-empty.jsonl"));

  const result = {
    summary: "Found 0 relevant guides (0 tracked, 0 new)",
    relevant: [],
    missing: [],
    suggested: []
  };

  const formatted = guides.formatSuggestions(result);

  assert(formatted.includes("No relevant guides found"), "Should indicate no results");
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
  console.log("Running Lemma Memory & Guides System Tests");
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
  await runTest("createFragment - explicit description", test_createFragment_explicitDescription);
  await runTest("createFragment - description generation", test_createFragment_descriptionGeneration);
  await runTest("formatMemoryDetail - full content", test_formatMemoryDetail_fullContent);
  await runTest("formatMemoryDetail - null fragment", test_formatMemoryDetail_null);
  await runTest("formatMemoryDetail - global scope", test_formatMemoryDetail_globalScope);
  await runTest("filterByProject - normalizes empty strings", test_filterByProject_normalizesEmptyStrings);

  console.log("\n--- GUIDES TESTS ---\n");
  await runTest("generateGuideId - correct format", test_guides_generateGuideId);
  await runTest("createGuide - creates valid object", test_guides_createGuide);
  await runTest("createGuide - normalizes inputs", test_guides_createGuide_normalizesInputs);
  await runTest("practiceGuide - increments usage", test_guides_practiceGuide);
  await runTest("practiceGuide - merges contexts and learnings", test_guides_mergeContextsLearnings);
  await runTest("practiceGuide - deduplicates learnings", test_guides_practiceGuide_deduplicatesLearnings);
  await runTest("findGuide - case insensitive", test_guides_findGuide);
  await runTest("getTopGuides - sorts by usage", test_guides_getTopGuides);
  await runTest("getTopGuides - respects limit", test_guides_getTopGuides_respectsLimit);
  await runTest("getGuidesByCategory - filters correctly", test_guides_getGuidesByCategory);
  await runTest("updateGuide - updates fields", test_guides_updateGuide);
  await runTest("updateGuide - returns null for non-existent", test_guides_updateGuide_notFound);
  await runTest("deleteGuide - removes guide", test_guides_deleteGuide);
  await runTest("deleteGuide - returns false for non-existent", test_guides_deleteGuide_notFound);
  await runTest("promoteToGuide - creates new guide", test_guides_promoteToGuide_createsNew);
  await runTest("promoteToGuide - adds to existing", test_guides_promoteToGuide_addsToExisting);
  await runTest("promoteToGuide - deduplicates learnings", test_guides_promoteToGuide_deduplicates);
  await runTest("loadGuides - empty file", test_guides_loadGuides_emptyFile);
  await runTest("loadGuides - with guides", test_guides_loadGuides_withGuides);
  await runTest("saveGuides - persists to disk", test_guides_saveGuides_persists);
  await runTest("formatGuidesForLLM - correct format", test_guides_formatGuidesForLLM);
  await runTest("formatGuidesForLLM - empty guides", test_guides_formatGuidesForLLM_empty);
  await runTest("formatGuideDetail - correct format", test_guides_formatGuideDetail);
  await runTest("formatGuideDetail - null guide", test_guides_formatGuideDetail_null);
  await runTest("suggestGuides - finds relevant", test_guides_suggestGuides_findsRelevant);
  await runTest("suggestGuides - separates tracked and missing", test_guides_suggestGuides_separatesTrackedAndMissing);
  await runTest("formatSuggestions - correct format", test_guides_formatSuggestions);
  await runTest("formatSuggestions - empty results", test_guides_formatSuggestions_empty);

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
