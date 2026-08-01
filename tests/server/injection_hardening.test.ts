import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as core from "../../src/memory/index.js";
import { buildDynamicInstructions } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";

describe("Project Name Markdown Injection Hardening", () => {
  let TMPDIR: string;

  beforeEach(() => {
    TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-hardening-"));
    core.setMemoryDir(TMPDIR);
  });

  afterEach(() => {
    core.setMemoryDir(path.join(os.homedir(), ".lemma"));
    fs.rmSync(TMPDIR, { recursive: true, force: true });
  });

  test("buildDynamicInstructions should sanitize project names with newlines to prevent header injection", async () => {
    const maliciousProject = "MyProject\n# Prompt Injection Alert!";
    const frag = core.createFragment("Test fragment content", "ai", "Test Title", maliciousProject);
    core.saveMemory([frag]);

    const instructions = buildDynamicInstructions(maliciousProject);

    // Verify display is sanitized (no newlines/unescaped header injection inside the project title)
    assert.ok(!instructions.includes("\n# Prompt Injection Alert!"), "Instructions should not contain the unescaped markdown header injection");
    assert.ok(instructions.includes("MyProject # Prompt Injection Alert!"), "Instructions should contain the sanitized project name on a single line");

    // Verify that querying memory still works (original name matches)
    assert.ok(instructions.includes("Test fragment content"), "Should still retrieve fragments using original project name");
  });

  test("getDynamicSystemPrompt should sanitize project names with newlines in formatProjectContext", async () => {
    const maliciousProject = "MyProject\n## Injection Header";
    const frag = core.createFragment("Test fragment content", "ai", "Test Title", maliciousProject);
    core.saveMemory([frag]);

    const prompt = await getDynamicSystemPrompt(maliciousProject);

    // Verify display is sanitized (no newlines/unescaped header injection inside the project title)
    assert.ok(!prompt.includes("\n## Injection Header"), "System prompt should not contain the unescaped markdown header injection");
    assert.ok(prompt.includes("MyProject ## Injection Header"), "System prompt should contain the sanitized project name on a single line");

    // Verify that querying memory still works (original name matches)
    assert.ok(prompt.includes("Test Title"), "Should still retrieve fragments using original project name");
  });
});
