import { test, describe } from "node:test";
import assert from "node:assert";
import {
  handleSessionStats,
  handleSessionStart,
  handleMemoryUpdate,
  handleMemoryAdd,
  handleMemoryRead,
} from "../../src/server/handlers.js";
import * as core from "../../src/memory/index.js";
import fs from "fs";
import path from "path";
import os from "os";

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

  test("handleSessionStats rejects NaN count", async () => {
    const result = await handleSessionStats({ count: NaN });
    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Error: 'count' must be a number/);
  });

  test("handleSessionStats defaults to 10 if count is undefined", async () => {
    const result = await handleSessionStats({});
    assert.strictEqual(result.isError, undefined);
    assert.match(result.content[0].text, /## Session Stats/);
  });
});

describe("Security Hardening - handleMemoryUpdate NaN Confidence", () => {
  test("handleMemoryUpdate rejects NaN confidence", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-sec-test-"));
    core.setMemoryDir(tmpDir);
    try {
      const addRes = await handleMemoryAdd({ fragment: "test fragment for nan confidence", title: "nan test" });
      const memory = core.loadMemory();
      const id = memory[0].id;

      const result = await handleMemoryUpdate({ id, confidence: NaN });
      assert.strictEqual(result.isError, true);
      assert.match(result.content[0].text, /Error: 'confidence' must be a number between 0 and 1/);
    } finally {
      core.setMemoryDir(path.join(os.homedir(), ".lemma"));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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
