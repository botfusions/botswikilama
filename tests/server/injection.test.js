import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import * as handlers from "../../src/server/handlers.js";
import { getDynamicSystemPrompt, BASE_SYSTEM_PROMPT } from "../../src/server/system-prompt.js";
import * as core_config from "../../src/memory/config.js";

let TMPDIR;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-"));
  core.setMemoryDir(TMPDIR);
  guides.setGuidesDir(TMPDIR);
});

afterEach(() => {
  core.setMemoryDir(path.join(os.homedir(), ".lemma"));
  guides.setGuidesDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("Dynamic System Prompt Injection", () => {
  test("getDynamicSystemPrompt returns base prompt structure", async () => {
    const prompt = await getDynamicSystemPrompt(null);
    assert.ok(prompt.includes("Lemma"));
    assert.ok(prompt.includes("<system_prompt>"));
    assert.ok(prompt.includes("</system_prompt>"));
  });

  test("getDynamicSystemPrompt includes project context with memories", async () => {
    const frag = core.createFragment("Project uses Next.js 15", "ai", "Next.js Stack", "TestProj");
    core.saveMemory([frag]);

    const prompt = await getDynamicSystemPrompt("TestProj");
    assert.ok(prompt.includes("<project_context>"));
    assert.ok(prompt.includes("TestProj"));
    assert.ok(prompt.includes("Next.js Stack"));
  });

  test("token budget is respected in system prompt", async () => {
    const frags = [];
    for (let i = 0; i < 50; i++) {
      frags.push(core.createFragment(
        `Fragment ${i}: ${"x".repeat(200)}`,
        "ai",
        `Title ${i}`,
        "BudgetProj"
      ));
    }
    core.saveMemory(frags);

    const prompt = await getDynamicSystemPrompt("BudgetProj");
    const projectCtx = prompt.match(/<project_context>([\s\S]*?)<\/project_context>/);
    assert.ok(projectCtx, "Should have project_context section");

    const idMatches = projectCtx[1].match(/\[m[a-f0-9]{6}\]/g) || [];
    assert.ok(idMatches.length <= 20, `Expected max 20 fragments in context, got ${idMatches.length}`);
  });

  test("high-confidence memories appear in project context", async () => {
    const high = core.createFragment("Very important fact", "ai", "HighConf", "ConfProj");
    high.confidence = 0.95;
    core.saveMemory([high]);

    const prompt = await getDynamicSystemPrompt("ConfProj");
    assert.ok(prompt.includes("HighConf"), "High-confidence memory should appear in project context");
    assert.ok(prompt.includes("Very important fact"));
  });

  test("global memories appear in global_knowledge section", async () => {
    const globalFrag = core.createFragment("Global user preference", "ai", "UserPrefs", null);
    core.saveMemory([globalFrag]);

    const prompt = await getDynamicSystemPrompt("AnyProject");
    assert.ok(prompt.includes("<global_knowledge>"), "Should have global_knowledge section");
    assert.ok(prompt.includes("UserPrefs"), "Global memory should appear in global_knowledge");
  });

  test("no injection when no memories exist", async () => {
    const prompt = await getDynamicSystemPrompt("EmptyProject");
    assert.ok(!prompt.includes("<project_context>"));
    assert.ok(!prompt.includes("<global_knowledge>"));
  });
});

describe("Config Override Token Budgets", () => {
  afterEach(() => {
    core_config.resetConfig();
  });

  test("config can be loaded with defaults", () => {
    core_config.resetConfig();
    const config = core_config.loadConfig();
    assert.ok(config.token_budget);
    assert.ok(config.token_budget.full_content > 0);
    assert.ok(config.injection);
    assert.ok(config.injection.max_full_content_fragments > 0);
  });

  test("estimateTokens returns reasonable estimates", () => {
    const short = core_config.estimateTokens("hello");
    const long = core_config.estimateTokens("a".repeat(350));
    assert.ok(short > 0);
    assert.ok(long > short);
    assert.ok(long < 350, "Token estimate should be less than char count");
  });
});

describe("Handler Dispatch with Injection Context", () => {
  test("memory_read returns content after injection context exists", async () => {
    const frag = core.createFragment("test data for injection", "ai", "InjectTest", "InjectProj");
    core.saveMemory([frag]);

    const prompt = await getDynamicSystemPrompt("InjectProj");
    assert.ok(prompt.includes("InjectTest"));

    const result = await handlers.handleMemoryRead({ project: "InjectProj" });
    assert.ok(!result.isError);
    assert.ok(result.content[0].text.includes("InjectTest"));
  });

  test("guide_get returns guides that would appear in injection", async () => {
    const gs = [guides.createGuide("injection-guide", "dev-tool", "Test guide for injection", ["ctx"], ["learn1"])];
    gs[0].usage_count = 10;
    guides.saveGuides(gs);

    const result = await handlers.handleGuideGet({});
    assert.ok(!result.isError);
    assert.ok(result.content[0].text.includes("injection-guide"));
  });
});
