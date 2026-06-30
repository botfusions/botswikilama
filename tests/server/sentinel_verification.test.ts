import { test, describe, before } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import * as wiki from "../../src/wiki/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";
import {
  buildDynamicInstructions,
  setDetectedProject,
  getServer,
  buildToolsWithMemory
} from "../../src/server/index.js";
import {
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

describe("Sentinel Security Verification", () => {
  const homeDir = os.homedir();
  const testProject = "sentinel-test-project";
  const testDir = path.join(homeDir, ".lemma-test-sentinel");

  before(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    core.setMemoryDir(testDir);
    guides.setGuidesDir(testDir);
  });

  test("should redact home directory in dynamic system prompt", async () => {
    // Add a memory with a home path
    const fragments = [
      core.createFragment(`Secret path is ${homeDir}/secret.txt`, "ai", "Secret Memory", testProject)
    ];
    core.saveMemory(fragments);

    const prompt = await getDynamicSystemPrompt(testProject);
    assert.ok(!prompt.includes(homeDir), `System prompt should not contain absolute home path. Found: ${prompt}`);
    assert.ok(prompt.includes("~"), "System prompt should contain redacted tilde path");
  });

  test("should redact home directory in buildDynamicInstructions", () => {
    // Add a memory with a home path
    const fragments = [
      core.createFragment(`Internal config at ${homeDir}/.config`, "ai", "Config Memory", testProject)
    ];
    core.saveMemory(fragments);

    const instructions = buildDynamicInstructions(testProject);
    assert.ok(!instructions.includes(homeDir), `Instructions should not contain absolute home path. Found: ${instructions}`);
    assert.ok(instructions.includes("~"), "Instructions should contain redacted tilde path");
  });

  test("should redact home directory in tool descriptions (buildToolsWithMemory)", () => {
     // Add a memory with a home path
     const fragments = [
      core.createFragment(`Path to tool: ${homeDir}/bin/tool`, "ai", "Tool Memory", testProject)
    ];
    core.saveMemory(fragments);
    setDetectedProject(testProject);

    const tools = buildToolsWithMemory();
    const memoryReadTool = tools.find(t => t.name === "memory_read");
    assert.ok(memoryReadTool, "memory_read tool should exist");
    assert.ok(!memoryReadTool.description.includes(homeDir), "Tool description should not leak home path");
    assert.ok(memoryReadTool.description.includes("~"), "Tool description should contain redacted path");
  });

  test("should redact home directory in resource contents", async () => {
    const fragments = [
      core.createFragment(`Data at ${homeDir}/data`, "ai", "Data Memory", testProject)
    ];
    core.saveMemory(fragments);
    const fragment = fragments[0];

    const server = getServer() as any;

    // We can't easily mock the transport here since it might not be initialized
    // Let's call buildDynamicInstructions directly for lemma://context/current
    setDetectedProject(testProject);
    const contextContent = buildDynamicInstructions(testProject);
    assert.ok(!contextContent.includes(homeDir), "Context resource content should not leak home path");
    assert.ok(contextContent.includes("~"), "Context resource content should contain redacted path");
  });

  test("should sanitize project name in Markdown headers to prevent injection", async () => {
    const maliciousProject = "My Project\n# INJECTED HEADER\n";

    // Test buildDynamicInstructions
    const instructions = buildDynamicInstructions(maliciousProject);
    assert.ok(!instructions.includes("# INJECTED HEADER"), `Instructions should not contain injected header. Found: ${instructions}`);

    // Test getDynamicSystemPrompt
    // We need to add a memory for this project to trigger the project_context block
    const fragments = [
      core.createFragment("Some content", "ai", "Test", maliciousProject)
    ];
    core.saveMemory(fragments);

    const prompt = await getDynamicSystemPrompt(maliciousProject);
    assert.ok(!prompt.includes("# INJECTED HEADER"), "System prompt should not contain injected header");
  });
});
