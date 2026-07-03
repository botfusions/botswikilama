import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import { buildToolsWithMemory, buildDynamicInstructions, setDetectedProject } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";

let TMPDIR: string;
const homeDir = os.homedir();

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-exposure-"));
  core.setMemoryDir(TMPDIR);
  guides.setGuidesDir(TMPDIR);
});

afterEach(() => {
  core.setMemoryDir(path.join(os.homedir(), ".lemma"));
  guides.setGuidesDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("Information Exposure Repro", () => {
  test("buildDynamicInstructions should redact home directory", async () => {
    const sensitivePath = path.join(homeDir, "sensitive-project");
    const frag = core.createFragment(`Path is ${sensitivePath}`, "ai", "PathMemory", "TestProj");
    core.saveMemory([frag]);

    const instructions = buildDynamicInstructions("TestProj");
    assert.ok(!instructions.includes(homeDir), "Instructions should not contain absolute home path");
    assert.ok(instructions.includes("~"), "Instructions should contain redacted tilde path");
  });

  test("buildToolsWithMemory should redact home directory in tool descriptions", async () => {
    const sensitivePath = path.join(homeDir, "sensitive-project");
    const frag = core.createFragment(`Path is ${sensitivePath}`, "ai", "PathMemory", "TestProj");
    core.saveMemory([frag]);

    setDetectedProject("TestProj");
    const tools = buildToolsWithMemory();
    const memoryRead = tools.find(t => t.name === "memory_read");
    assert.ok(memoryRead);

    assert.ok(!memoryRead.description.includes(homeDir), "Tool description should not contain absolute home path");
    assert.ok(memoryRead.description.includes("~"), "Tool description should contain redacted tilde path");
  });

  test("getDynamicSystemPrompt should redact home directory", async () => {
    const sensitivePath = path.join(homeDir, "sensitive-project");
    const frag = core.createFragment(`Path is ${sensitivePath}`, "ai", "PathMemory", "TestProj");
    core.saveMemory([frag]);

    const prompt = await getDynamicSystemPrompt("TestProj");
    assert.ok(!prompt.includes(homeDir), "System prompt should not contain absolute home path");
    assert.ok(prompt.includes("~"), "System prompt should contain redacted tilde path");
  });
});
