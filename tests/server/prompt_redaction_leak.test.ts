import { test, describe, before } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";

describe("Prompt Redaction Leak Security Extended", () => {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, ".lemma", "leak-test-extended");

  before(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    core.setMemoryDir(testDir);
    guides.setGuidesDir(testDir);

    const memoryFile = path.join(testDir, "memory.jsonl");
    const fragment = core.createFragment(
      `Confidential file at ${homeDir}/secret.txt`,
      "user",
      "Leak Title",
      "Leak Project",
      `Description with ${homeDir}`
    );
    fs.writeFileSync(memoryFile, JSON.stringify(fragment) + "\n");

    const guide = {
      id: "g1",
      guide: "leak-guide",
      category: "test",
      description: `Guide with path ${homeDir}`,
      usage_count: 1,
      last_used: new Date().toISOString(),
      contexts: [],
      learnings: [],
      success_count: 1,
      failure_count: 0,
      anti_patterns: [],
      known_pitfalls: [],
      last_refined: null,
      depends_on: [],
      enables: [],
      superseded_by: null,
      deprecated: false
    };
    guides.saveGuides([guide]);

    process.env.TEST_PROJECT = "Leak Project";
    const server = await import("../../src/server/index.js");
    server.setDetectedProject("Leak Project");
  });

  test("buildToolsWithMemory should redact home directory in tool descriptions", async () => {
    const server = await import("../../src/server/index.js");
    const tools = server.buildToolsWithMemory();
    const memoryReadTool = tools.find(t => t.name === "memory_read");
    assert.ok(memoryReadTool, "memory_read tool not found");
    assert.ok(!memoryReadTool.description.includes(homeDir), "Tool description contains home directory");
    assert.ok(memoryReadTool.description.includes("~"), "Tool description should contain tilde");
  });

  test("buildDynamicInstructions should redact home directory in instructions", async () => {
    const server = await import("../../src/server/index.js");
    const instructions = server.buildDynamicInstructions("Leak Project");
    assert.ok(!instructions.includes(homeDir), "Dynamic instructions contain home directory");
    assert.ok(instructions.includes("~"), "Dynamic instructions should contain tilde");
  });

  test("getDynamicSystemPrompt should redact home directory in system prompt", async () => {
    const systemPrompt = await import("../../src/server/system-prompt.js");
    const prompt = await systemPrompt.getDynamicSystemPrompt("Leak Project");
    assert.ok(!prompt.includes(homeDir), "System prompt contains home directory");
    assert.ok(prompt.includes("~"), "System prompt should contain tilde");
  });

  test("ReadResourceRequestSchema should redact home directory in memory resource", async () => {
    const server = await import("../../src/server/index.js");
    const mcpServer = server.getServer();

    const memory = core.loadMemory();
    const fragment = memory.find(f => f.title === "Leak Title");
    assert.ok(fragment, "Fragment not found");

    const responsePromise = new Promise((resolve) => {
      (mcpServer as any)._transport = {
        send: async (message: any) => {
          if (message.result) {
            resolve(message.result);
          }
        }
      };
    });

    await (mcpServer as any)._onrequest({
      id: 1,
      method: "resources/read",
      params: { uri: `lemma://memory/${fragment.id}` }
    });

    const result: any = await responsePromise;
    const text = result.contents[0].text;
    assert.ok(!text.includes(homeDir), "Memory resource contains home directory");
    assert.ok(text.includes("~"), "Memory resource should contain tilde");
  });

  test("ReadResourceRequestSchema should redact home directory in guide resource", async () => {
    const server = await import("../../src/server/index.js");
    const mcpServer = server.getServer();

    const responsePromise = new Promise((resolve) => {
      (mcpServer as any)._transport = {
        send: async (message: any) => {
          if (message.result) {
            resolve(message.result);
          }
        }
      };
    });

    await (mcpServer as any)._onrequest({
      id: 2,
      method: "resources/read",
      params: { uri: `lemma://guides/leak-guide` }
    });

    const result: any = await responsePromise;
    const text = result.contents[0].text;
    assert.ok(!text.includes(homeDir), "Guide resource contains home directory");
    assert.ok(text.includes("~"), "Guide resource should contain tilde");
  });
});
