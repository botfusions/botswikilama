import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import { buildDynamicInstructions, buildToolsWithMemory, getServer } from "../../src/server/index.js";
import { getDynamicSystemPrompt } from "../../src/server/system-prompt.js";
import { setMemoryDir } from "../../src/memory/core.js";
import { setGuidesDir } from "../../src/guides/core.js";

describe("Prompt and Resource Path Redaction Leak", () => {
  const homeDir = os.homedir();
  const TEST_DIR = path.join(homeDir, ".lemma-test-leak");

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    setMemoryDir(TEST_DIR);
    setGuidesDir(TEST_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  const setupLeakyMemory = (id: string, leak: string, project: string | null = "p") => {
    const memoryFile = path.join(TEST_DIR, "memory.jsonl");
    const fragment = { id, title: "Leak", fragment: `Path: ${leak}`, confidence: 1.0, project, created: "2025-01-01", lastAccessed: new Date().toISOString() };
    fs.appendFileSync(memoryFile, JSON.stringify(fragment) + "\n");
  };

  test("buildDynamicInstructions should REDACT absolute paths", async () => {
    setupLeakyMemory("m1", path.join(homeDir, "leak1"));
    const out = buildDynamicInstructions("p");
    assert.ok(!out.includes(homeDir), `Should not contain ${homeDir}`);
    assert.ok(out.includes("~"), "Should contain ~");
  });

  test("getDynamicSystemPrompt should REDACT absolute paths", async () => {
    setupLeakyMemory("m2", path.join(homeDir, "leak2"), null);
    const out = await getDynamicSystemPrompt(null);
    assert.ok(!out.includes(homeDir), `Should not contain ${homeDir}`);
    assert.ok(out.includes("~"), "Should contain ~");
  });

  test("buildToolsWithMemory should REDACT absolute paths", () => {
    setupLeakyMemory("m3", path.join(homeDir, "leak3"), null);
    const tool = buildToolsWithMemory().find(t => t.name === "memory_read");
    assert.ok(!tool?.description.includes(homeDir), `Should not contain ${homeDir}`);
    assert.ok(tool?.description.includes("~"), "Should contain ~");
  });

  test("Resource handlers should REDACT absolute paths", async () => {
    setupLeakyMemory("m4", path.join(homeDir, "leak4"), null);
    const handler = (getServer() as any)._requestHandlers.get("resources/read");
    const res = await handler({ method: "resources/read", params: { uri: "lemma://memory/m4" } }, {});
    assert.ok(!res.contents[0].text.includes(homeDir), `Should not contain ${homeDir}`);
    assert.ok(res.contents[0].text.includes("~"), "Should contain ~");
  });
});
