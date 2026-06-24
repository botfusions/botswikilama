import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import { buildDynamicInstructions, buildToolsWithMemory, setDetectedProject } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";

let TMPDIR: string;
const homeDir = os.homedir();

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-"));
  core.setMemoryDir(TMPDIR);
  guides.setGuidesDir(TMPDIR);
});

afterEach(() => {
  core.setMemoryDir(path.join(os.homedir(), ".lemma"));
  guides.setGuidesDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("Prompt Path Redaction Leak", () => {
  test("buildDynamicInstructions should redact home directory paths", async () => {
    const secretPath = path.join(homeDir, "secret-project");
    const frag = core.createFragment(`Working on ${secretPath}`, "ai", "PathLeak", "LeakProj");
    core.saveMemory([frag]);

    const instructions = buildDynamicInstructions("LeakProj");

    assert.ok(!instructions.includes(homeDir), "Instructions should NOT contain absolute home path");
    assert.ok(instructions.includes("~/secret-project"), "Instructions should contain redacted path");
  });

  test("buildToolsWithMemory should redact home directory paths in tool descriptions", async () => {
    const secretPath = path.join(homeDir, "top-secret");
    const frag = core.createFragment(`Config is at ${secretPath}`, "ai", "ToolLeak", "ToolProj");
    core.saveMemory([frag]);

    setDetectedProject("ToolProj");
    const tools = buildToolsWithMemory();
    const memoryRead = tools.find(t => t.name === "memory_read");

    assert.ok(memoryRead, "memory_read tool should exist");
    assert.ok(!memoryRead.description.includes(homeDir), "Tool description should NOT contain absolute home path");
    assert.ok(memoryRead.description.includes("~/top-secret"), "Tool description should contain redacted path");
  });

  test("getDynamicSystemPrompt should redact home directory paths", async () => {
    const secretPath = path.join(homeDir, "my-private-data");
    const frag = core.createFragment(`Data stored in ${secretPath}`, "ai", "PromptLeak", "PromptProj");
    core.saveMemory([frag]);

    const prompt = await getDynamicSystemPrompt("PromptProj");

    assert.ok(!prompt.includes(homeDir), "System prompt should NOT contain absolute home path");
    assert.ok(prompt.includes("~/my-private-data"), "System prompt should contain redacted path");
  });
});

describe("Project Name Markdown Injection", () => {
  test("buildDynamicInstructions should sanitize project name to prevent Markdown injection", () => {
    const maliciousProject = "MyProject)\n# Injected Header";
    const instructions = buildDynamicInstructions(maliciousProject);

    assert.ok(!instructions.includes("\n# Injected Header"), "Instructions should NOT contain injected header");
  });

  test("getDynamicSystemPrompt should sanitize project name to prevent Markdown injection", async () => {
    const maliciousProject = "MyProject\n## Injected Subheader";
    const prompt = await getDynamicSystemPrompt(maliciousProject);

    assert.ok(!prompt.includes("\n## Injected Subheader"), "System prompt should NOT contain injected subheader");
  });
});
