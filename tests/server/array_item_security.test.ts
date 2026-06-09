import { test } from "node:test";
import assert from "node:assert";
import {
  handleSessionStart,
  handleSessionEnd,
  handleMemoryRead,
  handleMemoryMerge,
  handleGuidePractice,
  handleGuideCreate,
  handleGuideUpdate,
  handleGuideMerge,
  handleWikiIngest
} from "../../src/server/handlers.js";

test("handleSessionStart rejects oversized technology item", async () => {
  const result = await handleSessionStart({
    task_type: "test",
    technologies: ["Valid", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
});

test("handleSessionEnd rejects oversized lesson item", async () => {
  const result = await handleSessionEnd({
    outcome: "success",
    lessons: ["Valid", "a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length of 2000 characters/);
});

test("handleMemoryRead rejects oversized id in ids array", async () => {
  const result = await handleMemoryRead({
    ids: ["valid-id", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
});

test("handleMemoryMerge rejects oversized id in ids array", async () => {
  const result = await handleMemoryMerge({
    ids: ["valid-id", "a".repeat(101)],
    title: "Merged",
    fragment: "Content"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
});

test("handleGuidePractice rejects oversized context item", async () => {
  const result = await handleGuidePractice({
    guide: "test",
    category: "dev",
    contexts: ["Valid", "a".repeat(101)],
    learnings: ["Valid"]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);
});

test("handleGuidePractice rejects oversized learning item", async () => {
  const result = await handleGuidePractice({
    guide: "test",
    category: "dev",
    contexts: ["Valid"],
    learnings: ["Valid", "a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
});

test("handleGuideCreate rejects oversized context item", async () => {
  const result = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "test description",
    contexts: ["Valid", "a".repeat(101)],
    learnings: ["Valid"]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);
});

test("handleGuideUpdate rejects oversized anti-pattern item", async () => {
  const result = await handleGuideUpdate({
    guide: "test",
    add_anti_patterns: ["Valid", "a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length of 2000 characters/);
});

test("handleGuideMerge rejects oversized guide name in guides array", async () => {
  const result = await handleGuideMerge({
    guides: ["Valid", "a".repeat(101)],
    guide: "New Guide",
    category: "dev"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'guides' item exceeds maximum length of 100 characters/);
});

test("handleWikiIngest rejects oversized entity item", async () => {
  const result = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "Test summary",
    entities: ["Valid", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length of 100 characters/);
});
