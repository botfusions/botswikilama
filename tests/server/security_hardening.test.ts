import { test, describe } from "node:test";
import assert from "node:assert";
import {
  handleSessionStats,
  handleSessionStart,
  handleMemoryUpdate,
} from "../../src/server/handlers.js";

describe("Security Hardening - handleSessionStats", () => {
  test("handleSessionStats rejects count > 100", async () => {
    const result = await handleSessionStats({ count: 101 });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'count' must be between 1 and 100/);
  });

  test("handleSessionStats rejects count < 1", async () => {
    const result = await handleSessionStats({ count: 0 });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'count' must be between 1 and 100/);
  });

  test("handleSessionStats rejects non-numeric count", async () => {
    // @ts-ignore
    const result = await handleSessionStats({ count: "10" });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'count' must be a number/);
  });

  test("handleSessionStats defaults to 10 if count is undefined", async () => {
    const result = await handleSessionStats({});
    assert.strictEqual(result.isError, undefined);
    assert.match(result.content[0].text, /## Session Stats/);
  });
});

describe("Security Hardening - Array Item Validation", () => {
  test("handleSessionStart rejects oversized technology item", async () => {
    const result = await handleSessionStart({
      task_type: "test",
      technologies: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
  });
});

describe("Security Hardening - handleMemoryUpdate Fail-Fast Validation", () => {
  test("rejects invalid confidence before checking fragment id existence", async () => {
    // @ts-ignore
    const result = await handleMemoryUpdate({ id: "non-existent-id", confidence: 1.5 });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'confidence' must be a number between 0 and 1/);
  });

  test("rejects NaN confidence early", async () => {
    const result = await handleMemoryUpdate({ id: "non-existent-id", confidence: NaN });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'confidence' must be a number between 0 and 1/);
  });
});
