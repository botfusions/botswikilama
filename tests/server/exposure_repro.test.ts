import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import os from "os";
import * as core from "../../src/memory/index.js";
import { buildDynamicInstructions, buildToolsWithMemory } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";
import path from "path";
import fs from "fs";

describe("Dynamic Content Path Exposure", () => {
  const homeDir = os.homedir();
  const tempMemoryDir = path.join(os.tmpdir(), "lemma-test-" + Date.now());

  beforeEach(() => {
    if (fs.existsSync(tempMemoryDir)) {
      fs.rmSync(tempMemoryDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempMemoryDir, { recursive: true });
    core.setMemoryDir(tempMemoryDir);
  });

  test("buildDynamicInstructions should redact home directory", async () => {
    const memory = core.loadMemory();
    const fragmentWithHome = `This is a secret path: ${homeDir}/secret-file.txt`;
    const newFragment = core.createFragment(fragmentWithHome, "ai", "Secret Path");
    memory.push(newFragment);
    core.saveMemory(memory);

    const instructions = buildDynamicInstructions(null);
    assert.ok(!instructions.includes(homeDir), "Instructions should not contain absolute home path");
    assert.ok(instructions.includes("~"), "Instructions should contain redacted tilde path");
  });

  test("buildToolsWithMemory should redact home directory", async () => {
    const memory = core.loadMemory();
    const fragmentWithHome = `This is a secret path: ${homeDir}/secret-file.txt`;
    const newFragment = core.createFragment(fragmentWithHome, "ai", "Secret Path");
    memory.push(newFragment);
    core.saveMemory(memory);

    const tools = buildToolsWithMemory();
    const memoryReadTool = tools.find(t => t.name === "memory_read");
    assert.ok(memoryReadTool, "memory_read tool should exist");
    assert.ok(!memoryReadTool.description.includes(homeDir), "Tool description should not contain absolute home path");
    assert.ok(memoryReadTool.description.includes("~"), "Tool description should contain redacted tilde path");
  });

  test("getDynamicSystemPrompt should redact home directory", async () => {
    const memory = core.loadMemory();
    const fragmentWithHome = `This is a secret path: ${homeDir}/secret-file.txt`;
    const newFragment = core.createFragment(fragmentWithHome, "ai", "Secret Path");
    memory.push(newFragment);
    core.saveMemory(memory);

    const prompt = await getDynamicSystemPrompt(null);
    assert.ok(!prompt.includes(homeDir), "System prompt should not contain absolute home path");
    assert.ok(prompt.includes("~"), "System prompt should contain redacted tilde path");
  });
});
