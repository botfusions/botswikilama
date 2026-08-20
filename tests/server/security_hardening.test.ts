import { test, describe } from "node:test";
import assert from "node:assert";
import os from "node:os";
import path from "node:path";
import {
  handleSessionStats,
  handleSessionStart,
  handleWikiSetup,
  handleWikiQuery,
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

describe("Security Hardening - Path Redaction in Wiki Errors", () => {
  test("handleWikiSetup redacts home directory when invalid character triggers exception", async () => {
    const homedir = os.homedir();
    const mockPath = path.join(homedir, "vault_dir\0invalid");
    const result = await handleWikiSetup({
      vault_path: mockPath
    });
    assert.strictEqual(result.isError, true);
    assert.ok(!result.content[0].text.includes(homedir));
    assert.ok(result.content[0].text.includes("~"));
  });
});
