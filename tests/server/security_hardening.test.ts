import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import * as core from "../../src/memory/index.js";
import {
  handleSessionStats,
  handleSessionStart,
  handleMemoryAdd,
  handleSessionEnd,
} from "../../src/server/handlers.js";

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-hardening-"));
  core.setMemoryDir(TMPDIR);
});

afterEach(() => {
  core.setMemoryDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

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

describe("Security Hardening - Source and Outcome Parameter Hardening", () => {
  test("handleMemoryAdd rejects invalid source parameter", async () => {
    const result = await handleMemoryAdd({
      fragment: "test content",
      source: "invalid_source"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'source' must be either 'user' or 'ai'/);
  });

  test("handleMemoryAdd accepts 'user' as source parameter", async () => {
    const resultUser = await handleMemoryAdd({
      fragment: "test content from user",
      source: "user"
    });
    assert.strictEqual(resultUser.isError, undefined);
  });

  test("handleMemoryAdd accepts 'ai' as source parameter", async () => {
    const resultAi = await handleMemoryAdd({
      fragment: "test content from AI",
      source: "ai"
    });
    assert.strictEqual(resultAi.isError, undefined);
  });

  test("handleSessionEnd rejects invalid outcome parameter", async () => {
    const result = await handleSessionEnd({
      outcome: "invalid_outcome"
    });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'outcome' must be one of 'success', 'partial', 'failure', or 'abandoned'/);
  });
});
