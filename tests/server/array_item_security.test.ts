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

describe("Array Item Length Security - DoS Protection", () => {

  test("handleSessionStart rejects oversized technology item", async () => {
    const result = await handleSessionStart({
      task_type: "valid",
      technologies: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length/);
  });

  test("handleSessionEnd rejects oversized lesson item", async () => {
    const result = await handleSessionEnd({
      outcome: "success",
      lessons: ["valid", "a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length/);
  });

  test("handleMemoryRead rejects oversized id in ids array", async () => {
    const result = await handleMemoryRead({
      ids: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length/);
  });

  test("handleMemoryMerge rejects oversized id in ids array", async () => {
    const result = await handleMemoryMerge({
      ids: ["m1", "a".repeat(101)],
      title: "valid",
      fragment: "valid"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length/);
  });

  test("handleGuidePractice rejects oversized context item", async () => {
    const result = await handleGuidePractice({
      guide: "test",
      category: "dev",
      contexts: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length/);
  });

  test("handleGuidePractice rejects oversized learning item", async () => {
    const result = await handleGuidePractice({
      guide: "test",
      category: "dev",
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length/);
  });

  test("handleGuideCreate rejects oversized context item", async () => {
    const result = await handleGuideCreate({
      guide: "test",
      category: "dev",
      description: "valid",
      contexts: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length/);
  });

  test("handleGuideCreate rejects oversized learning item", async () => {
    const result = await handleGuideCreate({
      guide: "test",
      category: "dev",
      description: "valid",
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length/);
  });

  test("handleGuideUpdate rejects oversized anti-pattern item", async () => {
    const result = await handleGuideUpdate({
      guide: "test",
      add_anti_patterns: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length/);
  });

  test("handleGuideUpdate rejects oversized pitfall item", async () => {
    const result = await handleGuideUpdate({
      guide: "test",
      add_pitfalls: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'add_pitfalls' item exceeds maximum length/);
  });

  test("handleGuideMerge rejects oversized guide name in guides array", async () => {
    const result = await handleGuideMerge({
      guides: ["g1", "a".repeat(101)],
      guide: "new",
      category: "dev"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'guides' item exceeds maximum length/);
  });

  test("handleWikiIngest rejects oversized entity item", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "valid",
      entities: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length/);
  });

  test("handleWikiIngest rejects oversized concept item", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "valid",
      concepts: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'concepts' item exceeds maximum length/);
  });

  test("handleWikiIngest rejects oversized decision item", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "valid",
      decisions: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'decisions' item exceeds maximum length/);
  });
});
