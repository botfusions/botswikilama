import { test, describe } from "node:test";
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

describe("Array Item Length Security Tests", () => {

  test("handleSessionStart rejects oversized technology item", async () => {
    const result = await handleSessionStart({
      task_type: "dev",
      technologies: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
  });

  test("handleSessionEnd rejects oversized lesson item", async () => {
    const result = await handleSessionEnd({
      outcome: "success",
      lessons: ["valid", "a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length of 2000 characters/);
  });

  test("handleMemoryRead rejects oversized id in ids array", async () => {
    const result = await handleMemoryRead({
      ids: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
  });

  test("handleMemoryMerge rejects oversized id in ids array", async () => {
    const result = await handleMemoryMerge({
      ids: ["valid", "a".repeat(101)],
      title: "merge",
      fragment: "merged"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
  });

  test("handleGuidePractice rejects oversized context item", async () => {
    const result = await handleGuidePractice({
      guide: "test",
      category: "dev",
      contexts: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);
  });

  test("handleGuidePractice rejects oversized learning item", async () => {
    const result = await handleGuidePractice({
      guide: "test",
      category: "dev",
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
  });

  test("handleGuideCreate rejects oversized learning item", async () => {
    const result = await handleGuideCreate({
      guide: "test",
      category: "dev",
      description: "manual",
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
  });

  test("handleGuideUpdate rejects oversized anti-pattern item", async () => {
    const result = await handleGuideUpdate({
      guide: "test",
      add_anti_patterns: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length of 2000 characters/);
  });

  test("handleGuideUpdate rejects oversized pitfall item", async () => {
    const result = await handleGuideUpdate({
      guide: "test",
      add_pitfalls: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'add_pitfalls' item exceeds maximum length of 2000 characters/);
  });

  test("handleGuideMerge rejects oversized guide name item", async () => {
    const result = await handleGuideMerge({
      guides: ["a".repeat(101), "other"],
      guide: "new",
      category: "dev"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'guides' item exceeds maximum length of 100 characters/);
  });

  test("handleWikiIngest rejects oversized entity item", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "sum",
      entities: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length of 100 characters/);
  });

  test("handleWikiIngest rejects oversized concept item", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "sum",
      concepts: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'concepts' item exceeds maximum length of 100 characters/);
  });

  test("handleWikiIngest rejects oversized decision item", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "sum",
      decisions: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'decisions' item exceeds maximum length of 100 characters/);
  });

});
