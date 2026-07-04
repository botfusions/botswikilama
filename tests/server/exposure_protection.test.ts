import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import os from "os";
import fs from "fs";
import path from "path";
import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import { buildDynamicInstructions, buildToolsWithMemory, setDetectedProject } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";

describe("Dynamic Context Path Exposure Protection", () => {
  const homeDir = os.homedir();
  const testDir = path.join(os.tmpdir(), `lemma-test-${Date.now()}`);

  beforeEach(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    core.setMemoryDir(testDir);
    guides.setGuidesDir(testDir);
    setDetectedProject("test-project");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    setDetectedProject(null);
  });

  test("buildDynamicInstructions should redact home directory", async () => {
    const memory = [
      core.createFragment(`Sensitive path: ${homeDir}/secret`, "ai", "Test Frag", "test-project")
    ];
    core.saveMemory(memory);

    const instructions = buildDynamicInstructions("test-project");
    assert.ok(instructions.includes("Test Frag"), "Should contain the fragment title");
    assert.ok(!instructions.includes(homeDir), `Instructions leaked home directory: ${instructions}`);
    assert.ok(instructions.includes("~"), "Instructions should have redacted path with ~");
  });

  test("getDynamicSystemPrompt should redact home directory", async () => {
    const memory = [
      core.createFragment(`Sensitive path: ${homeDir}/secret`, "ai", "Test Frag", "test-project")
    ];
    core.saveMemory(memory);

    const prompt = await getDynamicSystemPrompt("test-project");
    assert.ok(prompt.includes("Test Frag"), "Should contain the fragment title");
    assert.ok(!prompt.includes(homeDir), `System prompt leaked home directory: ${prompt}`);
    assert.ok(prompt.includes("~"), "System prompt should have redacted path with ~");
  });

  test("buildToolsWithMemory should redact home directory in tool descriptions", async () => {
    const memory = [
      core.createFragment(`Sensitive path: ${homeDir}/secret`, "ai", "Test Frag", "test-project")
    ];
    core.saveMemory(memory);

    const tools = buildToolsWithMemory();
    const memoryReadTool = tools.find(t => t.name === "memory_read");
    assert.ok(memoryReadTool, "Should find memory_read tool");

    const description = memoryReadTool.description;
    assert.ok(description.includes("Test Frag"), "Should contain the fragment title in description");
    assert.ok(!description.includes(homeDir), `Tool description leaked home directory: ${description}`);
    assert.ok(description.includes("~"), "Tool description should have redacted path with ~");
  });
});
