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
    path.join(__dirname, "memory-core.js"),
    "utf-8"
  );

  // Override MEMORY_FILE constant - use forward slashes for JS string
  const normalizedPath = memoryFilePath.replace(/\\/g, "/");
  const modifiedCode = originalCode.replace(
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

  const fragment1 = {
    id: "m000001",
    title: "Test 1",
    fragment: "Test content 1",
    confidence: 1.0,
    source: "ai",
    created: "2026-03-01",
    accessed: 0,
  };

  const fragment2 = {
    id: "m000002",
    title: "Test 2",
    fragment: "Test content 2",
    confidence: 1.0,
    source: "ai",
    created: "2026-03-01",
    accessed: 5,
  };

  const result = core.decayConfidence([fragment1, fragment2]);

  // First fragment: 1.0 - 0.05 = 0.95
  assert.strictEqual(result[0].confidence, 0.95, "Never accessed fragment should lose 0.05");

  // Second fragment: 1.0 - 0.025 = 0.975
  assert.strictEqual(result[1].confidence, 0.975, "5x accessed fragment should lose 0.025");
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

// Test 6: formatMemoryForLLM - correct format
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

// Test 7: generateId - correct format
async function test_generateId_correctFormat() {
  const core = await importWithOverride(path.join(tempDir, "id.jsonl"));

  const id = core.generateId();

  assert(id.startsWith("m"), "ID should start with 'm'");
  assert.strictEqual(id.length, 7, "ID should be 7 characters long");

  const hexPart = id.slice(1);
  assert(/^[0-9a-f]{6}$/.test(hexPart), "Last 6 chars should be hexadecimal");
}

// Test 8: createFragment - valid object
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
  assert(fragment.id.startsWith("m"), "ID should start with 'm'");
}

// Test 9: createFragment - auto title generation
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

// Test 10: filterByProject - correct filtering
async function test_filterByProject_correctFiltering() {
  const core = await importWithOverride(path.join(tempDir, "filter.jsonl"));

  const fragments = [
    { id: "m001", fragment: "Global 1", project: null, confidence: 1.0 },
    { id: "m002", fragment: "Global 2", project: undefined, confidence: 1.0 },
    { id: "m003", fragment: "Project A", project: "projectA", confidence: 1.0 },
    { id: "m004", fragment: "Project B", project: "projectB", confidence: 1.0 },
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

  console.log("\nRunning Lemma Memory System Tests\n");

  await runTest("loadMemory - empty file", test_loadMemory_emptyFile);
  await runTest("loadMemory - with fragments", test_loadMemory_withFragments);
  await runTest("saveMemory - creates directory", test_saveMemory_createsDirectory);
  await runTest("decayConfidence - reduces correctly", test_decayConfidence_reducesCorrectly);
  await runTest("decayConfidence - removes low fragments", test_decayConfidence_removesLowFragments);
  await runTest("formatMemoryForLLM - correct format", test_formatMemoryForLLM_correctFormat);
  await runTest("generateId - correct format", test_generateId_correctFormat);
  await runTest("createFragment - valid object", test_createFragment_validObject);
  await runTest("createFragment - auto title generation", test_createFragment_autoTitle);
  await runTest("filterByProject - correct filtering", test_filterByProject_correctFiltering);

  console.log("\n" + "=".repeat(50));
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log("=".repeat(50));

  await teardown();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
