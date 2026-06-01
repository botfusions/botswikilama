import { test, describe } from "node:test";
import assert from "node:assert";
import {
  handleSessionStart,
  handleSessionEnd,
  handleMemoryRead,
  handleMemoryUpdate,
  handleMemoryForget,
  handleMemoryFeedback,
  handleMemoryMerge,
  handleMemoryStats,
  handleGuideGet,
  handleGuideDistill,
  handleGuideUpdate,
  handleGuideForget,
  handleGuideMerge,
  handleWikiSetup,
  handleWikiIngest,
  handleWikiQuery,
  handleWikiLint
} from "../../src/server/handlers.js";

describe("Extended DoS Protection - Length Validation", () => {

  test("handleSessionStart rejects oversized task_type", async () => {
    const result = await handleSessionStart({ task_type: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'task_type' exceeds maximum length/);
  });

  test("handleSessionStart rejects oversized initial_approach", async () => {
    const result = await handleSessionStart({
      task_type: "valid",
      initial_approach: "a".repeat(2001)
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'initial_approach' exceeds maximum length/);
  });

  test("handleSessionEnd rejects oversized outcome", async () => {
    const result = await handleSessionEnd({ outcome: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'outcome' exceeds maximum length/);
  });

  test("handleMemoryRead rejects oversized id", async () => {
    const result = await handleMemoryRead({ id: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'id' exceeds maximum length/);
  });

  test("handleMemoryRead rejects oversized context", async () => {
    const result = await handleMemoryRead({ context: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'context' exceeds maximum length/);
  });

  test("handleMemoryUpdate rejects oversized id", async () => {
    const result = await handleMemoryUpdate({ id: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'id' exceeds maximum length/);
  });

  test("handleMemoryForget rejects oversized id", async () => {
    const result = await handleMemoryForget({ id: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'id' exceeds maximum length/);
  });

  test("handleMemoryFeedback rejects oversized id", async () => {
    const result = await handleMemoryFeedback({ id: "a".repeat(101), useful: true });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'id' exceeds maximum length/);
  });

  test("handleMemoryMerge rejects oversized title", async () => {
    const result = await handleMemoryMerge({
      ids: ["m1", "m2"],
      title: "a".repeat(201),
      fragment: "valid"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'title' exceeds maximum length/);
  });

  test("handleMemoryStats rejects oversized project", async () => {
    const result = await handleMemoryStats({ project: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'project' exceeds maximum length/);
  });

  test("handleGuideGet rejects oversized category", async () => {
    const result = await handleGuideGet({ category: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'category' exceeds maximum length/);
  });

  test("handleGuideDistill rejects oversized memory_id", async () => {
    const result = await handleGuideDistill({
      memory_id: "a".repeat(101),
      guide: "valid"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'memory_id' exceeds maximum length/);
  });

  test("handleGuideUpdate rejects oversized superseded_by", async () => {
    const result = await handleGuideUpdate({
      guide: "valid",
      superseded_by: "a".repeat(101)
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'superseded_by' exceeds maximum length/);
  });

  test("handleGuideForget rejects oversized guide", async () => {
    const result = await handleGuideForget({ guide: "a".repeat(101) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'guide' exceeds maximum length/);
  });

  test("handleWikiSetup rejects oversized vault_path", async () => {
    const result = await handleWikiSetup({ vault_path: "a".repeat(1025) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'vault_path' exceeds maximum length/);
  });

  test("handleWikiIngest rejects oversized file_path", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "valid",
      file_path: "a".repeat(1025)
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'file_path' exceeds maximum length/);
  });

  test("handleWikiQuery rejects oversized vault_path", async () => {
    const result = await handleWikiQuery({
      vault_path: "a".repeat(1025),
      query: "valid"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'vault_path' exceeds maximum length/);
  });

  test("handleWikiLint rejects oversized vault_path", async () => {
    const result = await handleWikiLint({ vault_path: "a".repeat(1025) });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'vault_path' exceeds maximum length/);
  });
});
