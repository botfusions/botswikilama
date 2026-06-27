import { test, describe } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import * as core from "../../src/memory/index.js";
import { buildDynamicInstructions, getServer } from "../../src/server/index.js";

describe("Sentinel Security: Prompt and Resource Hardening", () => {
  const homeDir = os.homedir();
  const testDir = path.join(os.tmpdir(), "lemma-test-sentinel-final");

  test("Dynamic components should redact home directory and sanitize project names", async () => {
    // 1. Setup memory with absolute path
    const memory = [{
      id: "m1", title: "Test", fragment: `Path: ${homeDir}/secret`,
      confidence: 1.0, source: "ai" as const, created: "2023-01-01",
      lastAccessed: new Date().toISOString(), accessed: 1, project: "injected\n# FAIL\n"
    }];
    core.setMemoryDir(testDir);
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "memory.jsonl"), memory.map(m => JSON.stringify(m)).join("\n"));

    // 2. Verify buildDynamicInstructions (Redaction + Sanitization)
    const instructions = buildDynamicInstructions("injected\n# FAIL\n");
    assert.ok(!instructions.includes(homeDir), "Should redact home path in instructions");
    assert.ok(!instructions.includes("\n# FAIL"), "Should sanitize project name in instructions");

    // 3. Verify JSON Resource Redaction
    const server = getServer();
    const handler = (server as any)._requestHandlers.get("resources/read");
    const response = await handler({
      method: "resources/read",
      params: { uri: "lemma://memory/m1" }
    });
    const content = response.contents[0].text;
    assert.ok(!content.includes(homeDir), "Should redact home path in JSON resource");
    assert.ok(content.includes("~"), "Should contain tilde in JSON resource");
  });
});
