import { test } from "node:test";
import assert from "node:assert";
import {
  handleSessionStart,
  handleSessionEnd,
  handleGuidePractice,
  handleGuideCreate,
  handleGuideUpdate,
  handleGuideMerge,
  handleWikiIngest
} from "../../src/server/handlers.js";

test("handleSessionStart rejects oversized technology", async () => {
  const result = await handleSessionStart({
    task_type: "test",
    technologies: ["valid", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
});

test("handleSessionEnd rejects oversized lesson", async () => {
  const result = await handleSessionEnd({
    outcome: "success",
    lessons: ["valid", "a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length of 2000 characters/);
});

test("handleGuidePractice rejects oversized context", async () => {
  const result = await handleGuidePractice({
    guide: "test",
    category: "dev",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);
});

test("handleGuidePractice rejects oversized learning", async () => {
  const result = await handleGuidePractice({
    guide: "test",
    category: "dev",
    learnings: ["a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
});

test("handleGuideCreate rejects oversized context", async () => {
  const result = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "test",
    contexts: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);
});

test("handleGuideUpdate rejects oversized anti-pattern", async () => {
  const result = await handleGuideUpdate({
    guide: "test",
    add_anti_patterns: ["a".repeat(2001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length of 2000 characters/);
});

test("handleGuideMerge rejects oversized guide name in list", async () => {
  const result = await handleGuideMerge({
    guides: ["valid", "a".repeat(101)],
    guide: "new",
    category: "dev"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'guides' item exceeds maximum length of 100 characters/);
});

test("handleWikiIngest rejects oversized entity", async () => {
  const result = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "test",
    entities: ["a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length of 100 characters/);
});
