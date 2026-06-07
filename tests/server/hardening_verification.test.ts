import { test } from "node:test";
import assert from "node:assert";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {
  handleSessionStart,
  handleSessionEnd,
  handleMemoryAdd,
  handleMemoryRead,
  handleGuideCreate,
  handleGuidePractice,
  handleGuideMerge,
  handleGuideUpdate
} from "../../src/server/handlers.js";
import { setMemoryDir } from "../../src/memory/core.js";
import { setGuidesDir } from "../../src/guides/core.js";
import { setSessionsDir } from "../../src/sessions/core.js";

const TEST_DIR = path.join(os.homedir(), ".lemma-test-hardening-verify");

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

test("handleSessionStart validates individual technology length", async () => {
  setup();
  const result = await handleSessionStart({
    task_type: "test",
    technologies: ["Valid", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length/);
  cleanup();
});

test("handleSessionStart sanitizes task_type and technologies for Markdown", async () => {
  setup();
  const result = await handleSessionStart({
    task_type: "Task\n# Injection",
    technologies: ["Tech\nInjection"]
  });
  assert.strictEqual(result.isError, undefined);
  assert.match(result.content[0].text, /Session started: .* \(Task # Injection\)/);
  assert.match(result.content[0].text, /Technologies: Tech Injection/);
  cleanup();
});

test("handleSessionEnd preserves newlines in lessons", async () => {
  setup();
  await handleSessionStart({ task_type: "test" });
  const result = await handleSessionEnd({
    outcome: "success",
    lessons: ["Lesson with\nNewline"]
  });
  assert.strictEqual(result.isError, undefined);

  const sessionsList = fs.readFileSync(path.join(TEST_DIR, "sessions.jsonl"), "utf-8");
  assert.ok(sessionsList.includes("Lesson with\\nNewline"));
  cleanup();
});

test("handleSessionEnd validates individual lesson length", async () => {
  setup();
  await handleSessionStart({ task_type: "test" });
  const result = await handleSessionEnd({
    outcome: "success",
    lessons: ["Valid", "a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length/);
  cleanup();
});

test("handleMemoryAdd sanitizes title and project for Markdown", async () => {
  setup();
  const result = await handleMemoryAdd({
    fragment: "Test fragment",
    title: "Title\nInjection",
    project: "Project\nInjection"
  });
  assert.strictEqual(result.isError, undefined);
  assert.match(result.content[0].text, /Added fragment \[.*\] \(project: Project Injection\): "Title Injection"/);
  cleanup();
});

test("handleGuideCreate validates individual context and learning lengths", async () => {
  setup();
  const res1 = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "desc",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(res1.isError, true);
  assert.match(res1.content[0].text, /Error: Individual 'contexts' item exceeds maximum length/);

  const res2 = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "desc",
    learnings: ["a".repeat(2001)]
  });
  assert.strictEqual(res2.isError, true);
  assert.match(res2.content[0].text, /Error: Individual 'learnings' item exceeds maximum length/);
  cleanup();
});

test("handleGuideUpdate validates individual anti-pattern and pitfall lengths", async () => {
  setup();
  await handleGuideCreate({ guide: "test", category: "dev", description: "desc" });

  const res1 = await handleGuideUpdate({
    guide: "test",
    add_anti_patterns: ["a".repeat(2001)]
  });
  assert.strictEqual(res1.isError, true);
  assert.match(res1.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length/);

  const res2 = await handleGuideUpdate({
    guide: "test",
    add_pitfalls: ["a".repeat(2001)]
  });
  assert.strictEqual(res2.isError, true);
  assert.match(res2.content[0].text, /Error: Individual 'add_pitfalls' item exceeds maximum length/);
  cleanup();
});

test("handleGuideMerge validates merged guides and items length", async () => {
  setup();
  await handleGuideCreate({ guide: "g1", category: "dev", description: "d1" });
  await handleGuideCreate({ guide: "g2", category: "dev", description: "d2" });

  const res1 = await handleGuideMerge({
    guides: ["g1", "a".repeat(101)],
    guide: "new",
    category: "dev"
  });
  assert.strictEqual(res1.isError, true);
  assert.match(res1.content[0].text, /Error: Individual 'guides' item exceeds maximum length/);

  const res2 = await handleGuideMerge({
    guides: ["g1", "g2"],
    guide: "new",
    category: "dev",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(res2.isError, true);
  assert.match(res2.content[0].text, /Error: Individual 'contexts' item exceeds maximum length/);
  cleanup();
});
