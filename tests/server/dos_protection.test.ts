import { test } from "node:test";
import assert from "node:assert";
import {
  handleMemoryAdd,
  handleMemoryUpdate,
  handleMemoryRead,
  handleWikiSetup,
  handleWikiIngest,
  handleWikiQuery,
  handleGuideCreate,
  handleGuidePractice,
  handleGuideUpdate,
  handleGuideMerge
} from "../../src/server/handlers.js";

test("handleMemoryAdd rejects oversized fragment", async () => {
  const result = await handleMemoryAdd({
    fragment: "a".repeat(10001),
    title: "short"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'fragment' exceeds maximum length/);
});

test("handleMemoryAdd rejects oversized title", async () => {
  const result = await handleMemoryAdd({
    fragment: "valid",
    title: "a".repeat(201)
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'title' exceeds maximum length/);
});

test("handleMemoryRead rejects oversized query", async () => {
  const result = await handleMemoryRead({
    query: "a".repeat(501)
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'query' exceeds maximum length/);
});

test("handleWikiSetup rejects oversized project_name", async () => {
  const result = await handleWikiSetup({
    vault_path: "/tmp/vault",
    project_name: "a".repeat(101)
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'project_name' exceeds maximum length/);
});

test("handleWikiIngest rejects oversized summary", async () => {
  const result = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "a".repeat(2001)
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'summary' exceeds maximum length/);
});

test("handleGuideCreate rejects oversized description", async () => {
  const result = await handleGuideCreate({
    guide: "test",
    category: "dev",
    description: "a".repeat(2001)
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'description' exceeds maximum length/);
});

test("handleGuideUpdate rejects oversized new_name", async () => {
  const result = await handleGuideUpdate({
    guide: "test",
    new_name: "a".repeat(101)
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'new_name' exceeds maximum length/);
});

test("handleMemoryRead rejects oversized ids count", async () => {
  const result = await handleMemoryRead({
    ids: Array(101).fill("m1")
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'ids' exceeds maximum count of 100 items/);
});

test("handleGuideMerge rejects oversized guides count", async () => {
  const result = await handleGuideMerge({
    guides: Array(51).fill("guide"),
    guide: "new",
    category: "test"
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'guides' exceeds maximum count of 50 items/);
});

test("handleWikiIngest rejects oversized entities count", async () => {
  const result = await handleWikiIngest({
    vault_path: "/tmp/vault",
    summary: "test",
    entities: Array(51).fill("entity")
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: 'entities' exceeds maximum count of 50 items/);
});
