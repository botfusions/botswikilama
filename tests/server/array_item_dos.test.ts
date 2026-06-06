import { test } from "node:test";
import assert from "node:assert";
import {
  handleSessionStart,
  handleWikiIngest,
  handleGuidePractice,
  handleMemoryMerge
} from "../../src/server/handlers.js";

test("handleSessionStart rejects oversized technology item", async () => {
  const result = await handleSessionStart({
    task_type: "debugging",
    technologies: ["valid", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
});

test("handleWikiIngest rejects oversized entity item", async () => {
  const result = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "valid summary",
    entities: ["valid", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length of 100 characters/);
});

test("handleGuidePractice rejects oversized learning item", async () => {
  const result = await handleGuidePractice({
    guide: "test",
    category: "dev",
    learnings: ["valid", "a".repeat(101)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 100 characters/);
});

test("handleMemoryMerge rejects oversized id item", async () => {
  const result = await handleMemoryMerge({
    ids: ["valid", "a".repeat(101)],
    title: "merged",
    fragment: "content"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
});
