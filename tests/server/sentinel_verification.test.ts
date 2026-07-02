import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import os from "os";
import fs from "fs";
import path from "path";
import * as core from "../../src/memory/core.js";
import { buildDynamicInstructions, buildToolsWithMemory, setDetectedProject } from "../../src/server/index.js";

describe("Dynamic Information Exposure Protection", () => {
  const homeDir = os.homedir();
  const testDir = path.join(os.tmpdir(), "lemma-test-" + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    core.setMemoryDir(testDir);
    // Add a memory fragment with an absolute path
    const fragments = [
      core.createFragment(
        `Sensitive path: ${homeDir}/secret/config.json`,
        "user",
        "Path Leak Test",
        "test-project"
      )
    ];
    core.saveMemory(fragments);
    setDetectedProject("test-project");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("buildDynamicInstructions should redact home directory", () => {
    const instructions = buildDynamicInstructions("test-project");
    assert.ok(!instructions.includes(homeDir), "Instructions should not contain absolute home path");
    assert.ok(instructions.includes("~"), "Instructions should contain redacted tilde path");
  });

  test("buildToolsWithMemory should redact home directory in tool descriptions", () => {
    const tools = buildToolsWithMemory();
    const memoryReadTool = tools.find(t => t.name === "memory_read");
    assert.ok(memoryReadTool, "memory_read tool should exist");
    assert.ok(!memoryReadTool.description.includes(homeDir), "Tool description should not contain absolute home path");
    assert.ok(memoryReadTool.description.includes("~"), "Tool description should contain redacted tilde path");
  });
});
