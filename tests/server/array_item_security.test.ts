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
  handleWikiIngest,
  handleSessionStats
} from "../../src/server/handlers.js";

test("handleSessionStart rejects oversized technology item", async () => {
  const result = await handleSessionStart({
    task_type: "test",
    technologies: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
});

test("handleSessionEnd rejects oversized lesson item", async () => {
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
    ids: ["id1", "a".repeat(101)],
    title: "title",
    fragment: "fragment"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
});

test("handleGuidePractice rejects oversized context and learning items", async () => {
  const result1 = await handleGuidePractice({
    guide: "test",
    category: "dev",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(result1.isError, true);
  assert.match(result1.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);

  const result2 = await handleGuidePractice({
    guide: "test",
    category: "dev",
    learnings: ["a".repeat(2001)]
  });
  assert.strictEqual(result2.isError, true);
  assert.match(result2.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
});

test("handleGuideCreate rejects oversized context and learning items", async () => {
  const result1 = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "desc",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(result1.isError, true);
  assert.match(result1.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);

  const result2 = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "desc",
    learnings: ["a".repeat(2001)]
  });
  assert.strictEqual(result2.isError, true);
  assert.match(result2.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
});

test("handleGuideUpdate rejects oversized anti-pattern and pitfall items", async () => {
  const result1 = await handleGuideUpdate({
    guide: "test",
    add_anti_patterns: ["a".repeat(2001)]
  });
  assert.strictEqual(result1.isError, true);
  assert.match(result1.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length of 2000 characters/);

  const result2 = await handleGuideUpdate({
    guide: "test",
    add_pitfalls: ["a".repeat(2001)]
  });
  assert.strictEqual(result2.isError, true);
  assert.match(result2.content[0].text, /Error: Individual 'add_pitfalls' item exceeds maximum length of 2000 characters/);
});

test("handleGuideMerge rejects oversized items in guide names, contexts and learnings", async () => {
  const result1 = await handleGuideMerge({
    guides: ["a".repeat(101), "guide2"],
    guide: "new",
    category: "dev"
  });
  assert.strictEqual(result1.isError, true);
  assert.match(result1.content[0].text, /Error: Individual 'guides' item exceeds maximum length of 100 characters/);

  const result2 = await handleGuideMerge({
    guides: ["guide1", "guide2"],
    guide: "new",
    category: "dev",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(result2.isError, true);
  assert.match(result2.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);

  const result3 = await handleGuideMerge({
    guides: ["guide1", "guide2"],
    guide: "new",
    category: "dev",
    learnings: ["a".repeat(2001)]
  });
  assert.strictEqual(result3.isError, true);
  assert.match(result3.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
});

test("handleWikiIngest rejects oversized entity, concept and decision items", async () => {
  const result1 = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "summary",
    entities: ["a".repeat(101)]
  });
  assert.strictEqual(result1.isError, true);
  assert.match(result1.content[0].text, /Error: Individual 'entities' item exceeds maximum length of 100 characters/);

  const result2 = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "summary",
    concepts: ["a".repeat(101)]
  });
  assert.strictEqual(result2.isError, true);
  assert.match(result2.content[0].text, /Error: Individual 'concepts' item exceeds maximum length of 100 characters/);

  const result3 = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "summary",
    decisions: ["a".repeat(101)]
  });
  assert.strictEqual(result3.isError, true);
  assert.match(result3.content[0].text, /Error: Individual 'decisions' item exceeds maximum length of 100 characters/);
});

test("handleSessionStats rejects invalid count", async () => {
  const result1 = await handleSessionStats({ count: 0 });
  assert.strictEqual(result1.isError, true);
  assert.match(result1.content[0].text, /Error: 'count' must be between 1 and 100/);

  const result2 = await handleSessionStats({ count: 101 });
  assert.strictEqual(result2.isError, true);
  assert.match(result2.content[0].text, /Error: 'count' must be between 1 and 100/);
});
