import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";
import { buildDynamicInstructions, buildToolsWithMemory, setDetectedProject } from "../../src/server/index.js";

describe("Prompt Redaction Leak Protection", () => {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, ".lemma", "test-prompt-redaction");
  const memoryFile = path.join(testDir, "memory.jsonl");
  const guidesFile = path.join(testDir, "guides.jsonl");

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    core.setMemoryDir(testDir);
    guides.setGuidesDir(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("getDynamicSystemPrompt should redact home directory in memory fragments", async () => {
    const sensitivePath = path.join(homeDir, "sensitive", "project");
    const fragment = core.createFragment(
      `This project is located at ${sensitivePath}`,
      "ai",
      `Path to ${sensitivePath}`,
      "test-project",
      `Summary of ${sensitivePath}`
    );
    core.saveMemory([fragment]);

    const prompt = await getDynamicSystemPrompt("test-project");

    assert.ok(!prompt.includes(homeDir), `System prompt should not contain absolute home path. Found: ${prompt}`);
    assert.ok(prompt.includes("~"), `System prompt should contain redacted tilde path. Found: ${prompt}`);
  });

  test("buildDynamicInstructions should redact home directory in memory fragments and guides", async () => {
    const sensitivePath = path.join(homeDir, "secret");
    const fragment = core.createFragment(
      `Secret path: ${sensitivePath}`,
      "ai",
      "Secret",
      "test-project"
    );

    const guide = guides.createGuide(
      "Secret Guide",
      "security",
      `How to handle ${sensitivePath}`,
      ["context"],
      [`Learned about ${sensitivePath}`]
    );

    core.saveMemory([fragment]);
    guides.saveGuides([guide]);

    const instructions = buildDynamicInstructions("test-project");

    assert.ok(!instructions.includes(homeDir), `Instructions should not contain absolute home path. Found: ${instructions}`);
    assert.ok(instructions.includes("~"), `Instructions should contain redacted tilde path. Found: ${instructions}`);
  });

  test("buildToolsWithMemory should redact home directory in tool descriptions", async () => {
    const sensitivePath = path.join(homeDir, "hidden");
    const fragment = core.createFragment(
      `Hidden at ${sensitivePath}`,
      "ai",
      "Hidden",
      "test-project"
    );
    core.saveMemory([fragment]);
    setDetectedProject("test-project");

    const tools = buildToolsWithMemory();
    const memoryReadTool = tools.find(t => t.name === "memory_read");

    assert.ok(memoryReadTool, "memory_read tool should exist");
    const description = memoryReadTool.description;

    assert.ok(!description.includes(homeDir), `Tool description should not contain absolute home path. Found: ${description}`);
    assert.ok(description.includes("~"), `Tool description should contain redacted tilde path. Found: ${description}`);
  });
});
