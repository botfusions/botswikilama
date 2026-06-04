import { handleMemoryAdd, handleGuideCreate, handleWikiSetup, handleWikiIngest } from "../../src/server/handlers.js";
import { setMemoryDir, loadMemory } from "../../src/memory/core.js";
import { setGuidesDir, loadGuides } from "../../src/guides/core.js";
import { setSessionsDir } from "../../src/sessions/core.js";
import * as wiki from "../../src/wiki/core.js";
import os from "os";
import path from "path";
import fs from "fs";
import assert from "assert";
import { test } from "node:test";

const TEST_DIR = path.join(os.homedir(), ".lemma-test-repro");

function setup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  setMemoryDir(TEST_DIR);
  setGuidesDir(TEST_DIR);
  setSessionsDir(TEST_DIR);
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

test("repro: memory_add title newline injection", async () => {
  setup();
  const result = await handleMemoryAdd({
    fragment: "Test fragment",
    title: "Title\n# Injection"
  });

  assert.strictEqual(result.isError, undefined);
  const memory = loadMemory();
  const frag = memory.find(f => f.fragment === "Test fragment");
  assert.ok(frag);
  // Desired behavior: Newlines should be sanitized
  assert.strictEqual(frag.title, "Title # Injection");
  cleanup();
});

test("repro: guide_create oversized learning item bypass", async () => {
  setup();
  const longLearning = "a".repeat(200); // MAX_LENGTHS.name is 100
  const result = await handleGuideCreate({
    guide: "test-guide",
    category: "test-cat",
    description: "test desc",
    learnings: [longLearning]
  });

  // Desired behavior: Should return error for oversized item
  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes("exceeds maximum length"));
  cleanup();
});

test("repro: wiki_ingest file_path newline injection in log", async () => {
  setup();
  const vaultPath = path.join(TEST_DIR, "vault");
  await handleWikiSetup({ vault_path: vaultPath });

  const result = await handleWikiIngest({
    vault_path: vaultPath,
    file_path: "path/to/file\n## Injection",
    summary: "Test summary",
    title: "Test Title"
  });

  assert.strictEqual(result.isError, undefined);
  const logContent = fs.readFileSync(path.join(vaultPath, "log.md"), "utf-8");
  // Desired behavior: Newline in file_path should be sanitized
  assert.ok(!logContent.includes("file: path/to/file\n## Injection"));
  assert.ok(logContent.includes("file: path/to/file ## Injection"));
  cleanup();
});
