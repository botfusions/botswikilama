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

test("handleSessionStart rejects oversized technology name in array", async () => {
  const result = await handleSessionStart({
    task_type: "test",
    technologies: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
});

test("handleSessionEnd rejects oversized lesson in array", async () => {
  const result = await handleSessionEnd({
    outcome: "success",
    lessons: ["a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length of 2000 characters/);
});

test("handleMemoryRead rejects oversized id in ids array", async () => {
  const result = await handleMemoryRead({
    ids: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
});

test("handleMemoryMerge rejects oversized id in ids array", async () => {
  const result = await handleMemoryMerge({
    ids: ["a", "a".repeat(101)],
    title: "Merged",
    fragment: "content"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
});

test("handleGuidePractice rejects oversized context in array", async () => {
  const result = await handleGuidePractice({
    guide: "test",
    category: "dev",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);
});

test("handleGuidePractice rejects oversized learning in array", async () => {
  const result = await handleGuidePractice({
    guide: "test",
    category: "dev",
    learnings: ["a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
});

test("handleGuideCreate rejects oversized context in array", async () => {
  const result = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "test description",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);
});

test("handleGuideUpdate rejects oversized anti-pattern in array", async () => {
  const result = await handleGuideUpdate({
    guide: "test",
    add_anti_patterns: ["a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length of 2000 characters/);
});

test("handleGuideUpdate rejects oversized pitfall in array", async () => {
  const result = await handleGuideUpdate({
    guide: "test",
    add_pitfalls: ["a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'add_pitfalls' item exceeds maximum length of 2000 characters/);
});

test("handleGuideMerge rejects oversized guide name in guides array", async () => {
  const result = await handleGuideMerge({
    guides: ["a", "a".repeat(101)],
    guide: "Merged",
    category: "dev"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'guides' item exceeds maximum length of 100 characters/);
});

test("handleWikiIngest rejects oversized entity in array", async () => {
  const result = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "valid summary",
    entities: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length of 100 characters/);
});
