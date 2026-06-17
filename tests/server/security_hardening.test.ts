import { test, describe } from "node:test";
import assert from "node:assert";
import {
  handleSessionStats,
  handleSessionStart,
  handleWikiIngest,
  handleMemoryRead
} from "../../src/server/handlers.js";

describe("Security Hardening - Range and Array Item Validation", () => {

  test("handleSessionStats rejects count < 1", async () => {
    const result = await handleSessionStats({ count: 0 });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'count' must be between 1 and 100/);
  });

  test("handleSessionStats rejects count > 100", async () => {
    const result = await handleSessionStats({ count: 101 });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'count' must be between 1 and 100/);
  });

  test("handleSessionStats accepts valid count", async () => {
    const result = await handleSessionStats({ count: 5 });
    assert.strictEqual(result.isError, undefined);
  });

  test("handleSessionStart rejects oversized technology item", async () => {
    const result = await handleSessionStart({
      task_type: "test",
      technologies: ["valid", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length of 100 characters/);
  });

  test("handleWikiIngest rejects oversized entity item", async () => {
    const result = await handleWikiIngest({
      vault_path: "/tmp/vault",
      summary: "valid summary",
      entities: ["a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'entities' item exceeds maximum length of 100 characters/);
  });

  test("handleMemoryRead rejects oversized id in ids array", async () => {
    const result = await handleMemoryRead({
      ids: ["valid-id", "a".repeat(101)]
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: Individual 'ids' item exceeds maximum length of 100 characters/);
  });

});
