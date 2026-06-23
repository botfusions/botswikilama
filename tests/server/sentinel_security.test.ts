import { test } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import * as core from "../../src/memory/index.js";
import * as wiki from "../../src/wiki/index.js";
import { buildDynamicInstructions } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.ts";

const TEST_DIR = path.join(os.homedir(), ".lemma", "sentinel_test");

function setup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  core.setMemoryDir(TEST_DIR);
}

test("buildDynamicInstructions redacts home directory paths", async () => {
  setup();
  const home = os.homedir();
  const fragment = `This is a secret path: ${home}/secret/file.txt`;

  const memory = [
    core.createFragment(fragment, "user", "Sensitive Info", "test-project")
  ];
  core.saveMemory(memory);

  const instructions = buildDynamicInstructions("test-project");

  assert.ok(!instructions.includes(home), "Instructions should not contain the absolute home directory path");
  assert.ok(instructions.includes("~/secret/file.txt"), "Instructions should contain the redacted path");
});

test("buildDynamicInstructions prevents markdown injection via project name", async () => {
  setup();
  const maliciousProjectName = "Project\n# Malicious Header\nInjection";

  const instructions = buildDynamicInstructions(maliciousProjectName);

  assert.ok(!instructions.includes("\n# Malicious Header"), "Instructions should not contain injected markdown headers");
  assert.ok(instructions.includes("Project # Malicious Header Injection"), "Project name should be sanitized and included with # preserved but newlines removed");
});

test("getDynamicSystemPrompt redacts home directory paths", async () => {
  setup();
  const home = os.homedir();
  const fragment = `Global secret: ${home}/global/secret.txt`;

  const memory = [
    core.createFragment(fragment, "user", "Global Sensitive", null)
  ];
  core.saveMemory(memory);

  const prompt = await getDynamicSystemPrompt(null);

  assert.ok(!prompt.includes(home), "System prompt should not contain the absolute home directory path");
  assert.ok(prompt.includes("~/global/secret.txt"), "System prompt should contain the redacted path");
});

test("getDynamicSystemPrompt prevents markdown injection via project name", async () => {
  setup();
  const maliciousProjectName = "Project\n# Malicious Header\nInjection";

  // Need some memory for project context to be generated
  const memory = [
    core.createFragment("test", "user", "Test", maliciousProjectName)
  ];
  core.saveMemory(memory);

  const prompt = await getDynamicSystemPrompt(maliciousProjectName);

  assert.ok(!prompt.includes("\n# Malicious Header"), "System prompt should not contain injected markdown headers");
  assert.ok(prompt.includes("Project # Malicious Header Injection"), "Project name should be sanitized and included with # preserved but newlines removed");
});
