import { test, describe } from "node:test";
import assert from "node:assert";
import os from "os";
import * as core from "../../src/memory/index.js";
import { buildDynamicInstructions, setDetectedProject } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";

describe("Sentinel Security Verification", () => {
  const homeDir = os.homedir();

  test("should redact paths and sanitize project name", async () => {
    const malicious = "My Project\n# Injected";
    const fragment = core.createFragment(`Path: ${homeDir}`, "ai", "Test", malicious);
    core.saveMemory([fragment]);

    const inst = buildDynamicInstructions(malicious);
    assert.ok(!inst.includes(homeDir) && inst.includes("~"), "Path disclosure in instructions");
    assert.ok(!inst.includes("\n# Injected"), "Markdown injection in instructions");

    const prompt = await getDynamicSystemPrompt(malicious);
    assert.ok(!prompt.includes(homeDir) && prompt.includes("~"), "Path disclosure in system prompt");
    assert.ok(!prompt.includes("\n# Injected"), "Markdown injection in system prompt");
  });
});
