import { test, describe } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import {
  handleSessionStart,
  handleSessionEnd,
  handleMemoryRead,
  handleMemoryMerge,
  handleGuidePractice,
  handleGuideCreate,
  handleGuideMerge,
  handleWikiIngest,
  handleGuideUpdate
} from "../../src/server/handlers.js";

describe("Array Item Length Validation", () => {
  test("handleSessionStart rejects oversized technology item", async () => {
    const result = await handleSessionStart({
      task_type: "test",
      technologies: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length/);
  });

  test("handleSessionEnd rejects oversized lesson item", async () => {
    const result = await handleSessionEnd({
      outcome: "success",
      lessons: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length/);
  });

  test("handleMemoryRead rejects oversized ids item", async () => {
    const result = await handleMemoryRead({
      ids: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length/);
  });

  test("handleMemoryMerge rejects oversized ids item", async () => {
    const result = await handleMemoryMerge({
      ids: ["m1", "a".repeat(101)],
      title: "merge",
      fragment: "merge"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length/);
  });

  test("handleGuidePractice rejects oversized context item", async () => {
    const result = await handleGuidePractice({
      guide: "test",
      category: "test",
      contexts: ["a".repeat(101)],
      learnings: ["learning"]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length/);
  });

  test("handleGuidePractice rejects oversized learning item", async () => {
    const result = await handleGuidePractice({
      guide: "test",
      category: "test",
      contexts: ["context"],
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'learnings' item exceeds maximum length/);
  });

  test("handleGuideCreate rejects oversized context item", async () => {
    const result = await handleGuideCreate({
      guide: "test",
      category: "test",
      description: "desc",
      contexts: ["a".repeat(101)],
      learnings: ["learning"]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'contexts' item exceeds maximum length/);
  });

  test("handleGuideMerge rejects oversized guides item", async () => {
    const result = await handleGuideMerge({
      guides: ["a".repeat(101), "g2"],
      guide: "new",
      category: "cat"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'guides' item exceeds maximum length/);
  });

  test("handleGuideUpdate rejects oversized anti-pattern item", async () => {
    const result = await handleGuideUpdate({
      guide: "test",
      add_anti_patterns: ["a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length/);
  });

  test("handleWikiIngest rejects oversized entity item", async () => {
    const vaultPath = path.join(os.homedir(), ".lemma-test-array");
    if (!fs.existsSync(vaultPath)) fs.mkdirSync(vaultPath, { recursive: true });
    fs.writeFileSync(path.join(vaultPath, "index.md"), "# Index");

    const result = await handleWikiIngest({
      vault_path: vaultPath,
      summary: "summary",
      entities: ["a".repeat(101)]
    });

    if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true });

    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length/);
  });
});
