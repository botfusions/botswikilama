import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as core from "../../src/memory/index.js";
import { buildToolsWithMemory, buildDynamicInstructions, setDetectedProject } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";

describe("Path Exposure in Dynamic Context", () => {
  const homeDir = os.homedir();
  let TMPDIR: string;

  beforeEach(() => {
    TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-exposure-"));
    core.setMemoryDir(TMPDIR);
  });

  afterEach(() => {
    core.setMemoryDir(path.join(os.homedir(), ".lemma"));
    fs.rmSync(TMPDIR, { recursive: true, force: true });
  });

  test("buildToolsWithMemory should redact paths in tool descriptions", async () => {
    const sensitivePath = path.join(homeDir, "secret-project");
    const frag = core.createFragment(`This project is at ${sensitivePath}`, "ai", "Project Path", "LeakProj");
    core.saveMemory([frag]);
    setDetectedProject("LeakProj");

    const tools = buildToolsWithMemory();
    const memoryRead = tools.find(t => t.name === "memory_read");
    assert.ok(memoryRead);

    assert.ok(!memoryRead.description.includes(homeDir), "Tool description should not contain absolute home path");
    assert.ok(memoryRead.description.includes("~"), "Tool description should contain redacted path");
  });

  test("buildDynamicInstructions should redact paths", async () => {
    const sensitivePath = path.join(homeDir, "my-private-files");
    const frag = core.createFragment(`Found files in ${sensitivePath}`, "ai", "Private Files", "LeakProj");
    core.saveMemory([frag]);

    const instructions = buildDynamicInstructions("LeakProj");
    assert.ok(!instructions.includes(homeDir), "Instructions should not contain absolute home path");
    assert.ok(instructions.includes("~"), "Instructions should contain redacted path");
  });

  test("getDynamicSystemPrompt should redact paths", async () => {
    const sensitivePath = path.join(homeDir, "config-dir");
    const frag = core.createFragment(`Config is at ${sensitivePath}`, "ai", "Config Location", "LeakProj");
    core.saveMemory([frag]);

    const prompt = await getDynamicSystemPrompt("LeakProj");
    assert.ok(!prompt.includes(homeDir), "System prompt should not contain absolute home path");
    assert.ok(prompt.includes("~"), "System prompt should contain redacted path");
  });
});
