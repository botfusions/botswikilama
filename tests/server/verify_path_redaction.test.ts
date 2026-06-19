import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";
import { buildToolsWithMemory, buildDynamicInstructions, setDetectedProject } from "../../src/server/index.js";

let TMPDIR: string;
const HOME_DIR = os.homedir();

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-leak-"));
  core.setMemoryDir(TMPDIR);
  guides.setGuidesDir(TMPDIR);
});

afterEach(() => {
  core.setMemoryDir(path.join(os.homedir(), ".lemma"));
  guides.setGuidesDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("Path Exposure Fix Verification", () => {
  test("getDynamicSystemPrompt redacts home directory in memory fragments", async () => {
    const leakPath = path.join(HOME_DIR, "secret", "file.txt");
    const frag = core.createFragment(`Path is ${leakPath}`, "ai", "Leak Title", "LeakProj");
    core.saveMemory([frag]);

    const prompt = await getDynamicSystemPrompt("LeakProj");
    assert.ok(!prompt.includes(HOME_DIR), `System prompt should NOT contain leaked home path. Found: ${prompt}`);
    assert.ok(prompt.includes("~/secret/file.txt"), "System prompt should contain redacted path");
  });

  test("buildToolsWithMemory redacts home directory in tool descriptions", () => {
    const leakPath = path.join(HOME_DIR, "secret", "file.txt");
    const frag = core.createFragment(`Path is ${leakPath}`, "ai", "Leak Title", "LeakProj");
    core.saveMemory([frag]);

    setDetectedProject("LeakProj");
    const tools = buildToolsWithMemory();
    const memoryRead = tools.find(t => t.name === "memory_read");
    assert.ok(memoryRead);

    assert.ok(!memoryRead!.description.includes(HOME_DIR), "Tool description should NOT contain leaked home path");
    assert.ok(memoryRead!.description.includes("~/secret/file.txt"), "Tool description should contain redacted path");
  });

  test("buildDynamicInstructions redacts home directory in instructions", () => {
    const leakPath = path.join(HOME_DIR, "secret", "file.txt");
    const frag = core.createFragment(`Path is ${leakPath}`, "ai", "Leak Title", "LeakProj");
    core.saveMemory([frag]);

    const instructions = buildDynamicInstructions("LeakProj");
    assert.ok(!instructions.includes(HOME_DIR), "Instructions should NOT contain leaked home path");
    assert.ok(instructions.includes("~/secret/file.txt"), "Instructions should contain redacted path");
  });
});
