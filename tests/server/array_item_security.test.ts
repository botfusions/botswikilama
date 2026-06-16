import { test, describe } from "node:test";
import assert from "node:assert";
import {
  handleSessionStart,
  handleSessionEnd,
  handleSessionStats,
  handleMemoryRead,
  handleMemoryMerge,
  handleGuidePractice,
  handleGuideCreate,
  handleGuideUpdate,
  handleGuideMerge,
  handleWikiIngest
} from "../../src/server/handlers.js";

describe("Array Item Length and Range Security", () => {

  test("handleSessionStats rejects out of range count", async () => {
    // Large count
    const resultLarge = await handleSessionStats({ count: 101 });
    assert.strictEqual(resultLarge.isError, true);
    assert.match(resultLarge.content[0].text, /Error: 'count' must be between 1 and 100/);

    // Zero count
    const resultZero = await handleSessionStats({ count: 0 });
    assert.strictEqual(resultZero.isError, true);
    assert.match(resultZero.content[0].text, /Error: 'count' must be between 1 and 100/);

    // Negative count
    const resultNeg = await handleSessionStats({ count: -1 });
    assert.strictEqual(resultNeg.isError, true);
    assert.match(resultNeg.content[0].text, /Error: 'count' must be between 1 and 100/);
  });

  test("handleSessionStart validates technologies item length", async () => {
    const result = await handleSessionStart({
      task_type: "test",
      technologies: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
  });

  test("handleSessionEnd validates lessons item length", async () => {
    const result = await handleSessionEnd({
      outcome: "success",
      lessons: ["valid", "a".repeat(2001)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length of 2000 characters/);
  });

  test("handleMemoryRead validates ids item length", async () => {
    const result = await handleMemoryRead({
      ids: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
  });

  test("handleMemoryMerge validates ids item length", async () => {
    const result = await handleMemoryMerge({
      ids: ["valid", "a".repeat(101)],
      title: "merged",
      fragment: "content"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
  });

  test("handleGuidePractice validates contexts and learnings item length", async () => {
    const resultContext = await handleGuidePractice({
      guide: "test",
      category: "dev",
      contexts: ["a".repeat(101)],
      learnings: ["valid"]
    });
    assert.strictEqual(resultContext.isError, true);
    assert.match(resultContext.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);

    const resultLearning = await handleGuidePractice({
      guide: "test",
      category: "dev",
      contexts: ["valid"],
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(resultLearning.isError, true);
    assert.match(resultLearning.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
  });

  test("handleGuideCreate validates contexts and learnings item length", async () => {
    const resultContext = await handleGuideCreate({
      guide: "test",
      category: "dev",
      description: "desc",
      contexts: ["a".repeat(101)],
      learnings: ["valid"]
    });
    assert.strictEqual(resultContext.isError, true);
    assert.match(resultContext.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);

    const resultLearning = await handleGuideCreate({
      guide: "test",
      category: "dev",
      description: "desc",
      contexts: ["valid"],
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(resultLearning.isError, true);
    assert.match(resultLearning.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
  });

  test("handleGuideUpdate validates add_anti_patterns and add_pitfalls item length", async () => {
    const resultAnti = await handleGuideUpdate({
      guide: "test",
      add_anti_patterns: ["a".repeat(101)]
    });
    assert.strictEqual(resultAnti.isError, true);
    assert.match(resultAnti.content[0].text, /Error: Individual 'add_anti_patterns' item exceeds maximum length of 100 characters/);

    const resultPitfall = await handleGuideUpdate({
      guide: "test",
      add_pitfalls: ["a".repeat(101)]
    });
    assert.strictEqual(resultPitfall.isError, true);
    assert.match(resultPitfall.content[0].text, /Error: Individual 'add_pitfalls' item exceeds maximum length of 100 characters/);
  });

  test("handleGuideMerge validates guides, contexts and learnings item length", async () => {
    const resultGuides = await handleGuideMerge({
      guides: ["valid", "a".repeat(101)],
      guide: "new",
      category: "dev"
    });
    assert.strictEqual(resultGuides.isError, true);
    assert.match(resultGuides.content[0].text, /Error: Individual 'guides' item exceeds maximum length of 100 characters/);

    const resultContext = await handleGuideMerge({
      guides: ["g1", "g2"],
      guide: "new",
      category: "dev",
      contexts: ["a".repeat(101)]
    });
    assert.strictEqual(resultContext.isError, true);
    assert.match(resultContext.content[0].text, /Error: Individual 'contexts' item exceeds maximum length of 100 characters/);

    const resultLearning = await handleGuideMerge({
      guides: ["g1", "g2"],
      guide: "new",
      category: "dev",
      learnings: ["a".repeat(2001)]
    });
    assert.strictEqual(resultLearning.isError, true);
    assert.match(resultLearning.content[0].text, /Error: Individual 'learnings' item exceeds maximum length of 2000 characters/);
  });

});
