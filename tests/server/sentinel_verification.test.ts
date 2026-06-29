import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import os from "os";
import fs from "fs";
import path from "path";
import * as core from "../../src/memory/index.js";
import { buildDynamicInstructions, buildToolsWithMemory } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";

describe("Sentinel Verification - Path Redaction and Sanitization", () => {
  const homeDir = os.homedir();
  const testDir = path.join(os.tmpdir(), "lemma-test-" + Date.now());

  before(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    core.setMemoryDir(testDir);
  });

  after(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("buildDynamicInstructions should redact home directory", async () => {
    const fragments = [
      core.createFragment(`The secret is in ${homeDir}/secrets.txt`, "ai", "Secret Path")
    ];
    core.saveMemory(fragments, { force: true });

    const instructions = buildDynamicInstructions(null);
    assert.ok(!instructions.includes(homeDir), "Instructions should not contain absolute home path");
    assert.ok(instructions.includes("~"), "Instructions should contain redacted tilde path");
  });

  test("buildToolsWithMemory should redact home directory in tool description", async () => {
    const fragments = [
      core.createFragment(`Path: ${homeDir}/repo`, "ai", "Repo Path")
    ];
    core.saveMemory(fragments, { force: true });

    const tools = buildToolsWithMemory();
    const memoryReadTool = tools.find(t => t.name === "memory_read");
    assert.ok(memoryReadTool, "memory_read tool should exist");
    assert.ok(!memoryReadTool.description.includes(homeDir), "Tool description should not contain absolute home path");
    assert.ok(memoryReadTool.description.includes("~"), "Tool description should contain redacted tilde path");
  });

  test("getDynamicSystemPrompt should redact home directory", async () => {
    const fragments = [
      core.createFragment(`Key at ${homeDir}/.ssh/id_rsa`, "ai", "SSH Key")
    ];
    core.saveMemory(fragments, { force: true });

    const prompt = await getDynamicSystemPrompt(null);
    assert.ok(!prompt.includes(homeDir), "System prompt should not contain absolute home path");
    assert.ok(prompt.includes("~"), "System prompt should contain redacted tilde path");
  });

  test("buildDynamicInstructions should sanitize project name", () => {
    const projectName = "My Project\n# Injection";
    const instructions = buildDynamicInstructions(projectName);
    assert.ok(!instructions.includes("\n# Injection"), "Instructions should not contain injected header");
    assert.ok(instructions.includes("My Project # Injection"), "Instructions should contain sanitized project name");
  });
});
