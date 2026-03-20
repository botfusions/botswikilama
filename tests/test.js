// Lemma Test Suite
// Uses node:test + node:assert — NO external dependencies
// All I/O is isolated to a temp directory — real ~/.lemma/ is NEVER touched

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as core from "../src/memory/index.js";
import * as guides from "../src/guides/index.js";
import * as handlers from "../src/server/handlers.js";
import * as hooks from "../src/server/hooks.js";
import { getDynamicSystemPrompt } from "../src/server/system-prompt.js";

// ── Isolation: redirect all I/O to a temp dir ──────────────────────────
let TMPDIR;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-"));
  core.setMemoryDir(TMPDIR);
  guides.setGuidesDir(TMPDIR);
});

afterEach(() => {
  // Restore defaults so production is unaffected
  core.setMemoryDir(path.join(os.homedir(), ".lemma"));
  guides.setGuidesDir(path.join(os.homedir(), ".lemma"));
  // Clean up temp dir
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════
// MEMORY CORE
// ═══════════════════════════════════════════════════════════════════════

describe("Memory Core", () => {

  // ── createFragment ──────────────────────────────────────────────────

  describe("createFragment", () => {
    test("creates a fragment with all required fields", () => {
      const frag = core.createFragment("hello world", "ai", "Test", "myproj");
      assert.equal(frag.confidence, 1.0);
      assert.equal(frag.source, "ai");
      assert.equal(frag.project, "myproj");
      assert.equal(frag.title, "Test");
      assert.equal(frag.accessed, 0);
      assert.deepEqual(frag.tags, []);
      assert.deepEqual(frag.associatedWith, []);
      assert.equal(frag.negativeHits, 0);
      assert.ok(frag.id.startsWith("m"));
      assert.ok(frag.created);
      assert.ok(frag.lastAccessed);
    });

    test("auto-generates title when not provided", () => {
      const frag = core.createFragment("short text", "ai");
      assert.equal(frag.title, "short text");
    });

    test("truncates title for long fragments", () => {
      const long = "a".repeat(60);
      const frag = core.createFragment(long, "ai");
      assert.ok(frag.title.length <= 43);
    });

    test("creates global fragment when project is null", () => {
      const frag = core.createFragment("global info", "user", "Title", null);
      assert.equal(frag.project, null);
    });
  });

  // ── loadMemory / saveMemory ────────────────────────────────────────

  describe("loadMemory / saveMemory", () => {
    test("returns empty array when no file exists", () => {
      assert.deepEqual(core.loadMemory(), []);
    });

    test("persists fragments to disk as JSONL", () => {
      const frags = [core.createFragment("test", "ai")];
      core.saveMemory(frags);
      const loaded = core.loadMemory();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].fragment, "test");
    });

    test("refuses to save empty array (safety check)", () => {
      // First write something so the file exists
      const frags = [core.createFragment("seed", "ai")];
      core.saveMemory(frags);

      // Now try to save empty — should be aborted
      core.saveMemory([]);

      // Original data should still be there
      const loaded = core.loadMemory();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].fragment, "seed");
    });

    test("creates cumulative backup on save", () => {
      const f1 = core.createFragment("first", "ai");
      core.saveMemory([f1]);

      const f2 = core.createFragment("second", "ai");
      core.saveMemory([f2]);

      // Backup should have BOTH entries
      const bakPath = path.join(TMPDIR, "memory.jsonl.bak");
      const bakContent = fs.readFileSync(bakPath, "utf-8");
      const bakEntries = bakContent.trim().split("\n");
      assert.equal(bakEntries.length, 2);
    });
  });

  // ── filterByProject ────────────────────────────────────────────────

  describe("filterByProject", () => {
    test("filters by project scope (case-insensitive)", () => {
      const frags = [
        core.createFragment("global", "ai", "G", null),
        core.createFragment("proj-a", "ai", "A", "Alpha"),
        core.createFragment("proj-b", "ai", "B", "beta"),
      ];
      assert.equal(core.filterByProject(frags, "alpha").length, 1);
      assert.equal(core.filterByProject(frags, "ALPHA").length, 1);
      assert.equal(core.filterByProject(frags, null).length, 1);
    });

    test("treats empty string as null (global)", () => {
      const frags = [
        core.createFragment("g", "ai", "G", null),
        core.createFragment("p", "ai", "P", "proj"),
      ];
      assert.equal(core.filterByProject(frags, "").length, 1);
      assert.equal(core.filterByProject(frags, "   ").length, 1);
    });
  });

  // ── findSimilarFragment ────────────────────────────────────────────

  describe("findSimilarFragment", () => {
    test("finds similar fragment above threshold", () => {
      const frags = [core.createFragment("react hooks use state management patterns", "ai", "React", "proj")];
      const match = core.findSimilarFragment(frags, "react hooks use state patterns", "proj", 0.5);
      assert.ok(match);
      assert.equal(match.title, "React");
    });

    test("returns null when no similar fragment exists", () => {
      const frags = [core.createFragment("python asyncio", "ai", "Py", "proj")];
      const match = core.findSimilarFragment(frags, "react components", "proj");
      assert.equal(match, null);
    });
  });

  // ── decayConfidence ────────────────────────────────────────────────

  describe("decayConfidence", () => {
    test("reduces confidence for unused fragments", () => {
      const frag = { ...core.createFragment("test", "ai"), accessed: 0 };
      const [decayed] = core.decayConfidence([frag]);
      assert.ok(decayed.confidence < frag.confidence);
    });

    test("resets accessed counter after decay", () => {
      const frag = { ...core.createFragment("test", "ai"), accessed: 5 };
      const [decayed] = core.decayConfidence([frag]);
      assert.equal(decayed.accessed, 0);
    });

    test("never removes fragments, only reduces confidence", () => {
      const frags = [core.createFragment("a", "ai"), core.createFragment("b", "ai")];
      const decayed = core.decayConfidence(frags);
      assert.equal(decayed.length, 2);
    });

    test("confidence never goes below 0", () => {
      const frag = { ...core.createFragment("test", "ai"), confidence: 0.01, accessed: 0 };
      const [decayed] = core.decayConfidence([frag]);
      assert.ok(decayed.confidence >= 0);
    });

    test("negative hits do not affect decay rate", () => {
      const normal = { ...core.createFragment("normal", "ai"), accessed: 0, negativeHits: 0 };
      const hated = { ...core.createFragment("hated", "ai"), accessed: 0, negativeHits: 5 };

      const [decayedNormal] = core.decayConfidence([normal]);
      const [decayedHated] = core.decayConfidence([hated]);

      assert.equal(decayedNormal.confidence, decayedHated.confidence,
        "negativeHits should not affect decay rate");
    });

    test("resets negativeHits after decay", () => {
      const frag = { ...core.createFragment("test", "ai"), accessed: 0, negativeHits: 3 };
      const [decayed] = core.decayConfidence([frag]);
      assert.equal(decayed.negativeHits, 0);
    });
  });

  // ── boostOnAccess ──────────────────────────────────────────────────

  describe("boostOnAccess", () => {
    test("increases confidence by 0.1", () => {
      const frag = { ...core.createFragment("test", "ai"), confidence: 0.5 };
      const boosted = core.boostOnAccess(frag);
      assert.equal(boosted.confidence, 0.6);
    });

    test("never exceeds 1.0", () => {
      const frag = { ...core.createFragment("test", "ai"), confidence: 0.95 };
      const boosted = core.boostOnAccess(frag);
      assert.equal(boosted.confidence, 1.0);
    });

    test("adds context tag", () => {
      const frag = core.createFragment("test", "ai");
      const boosted = core.boostOnAccess(frag, "debugging");
      assert.deepEqual(boosted.tags, ["debugging"]);
    });

    test("does not duplicate tags", () => {
      const frag = { ...core.createFragment("test", "ai"), tags: ["debugging"] };
      const boosted = core.boostOnAccess(frag, "debugging");
      assert.deepEqual(boosted.tags, ["debugging"]);
    });

    test("normalizes tag to lowercase", () => {
      const frag = core.createFragment("test", "ai");
      const boosted = core.boostOnAccess(frag, "DEBUGGING");
      assert.deepEqual(boosted.tags, ["debugging"]);
    });

    test("increments accessed counter", () => {
      const frag = { ...core.createFragment("test", "ai"), accessed: 2 };
      const boosted = core.boostOnAccess(frag);
      assert.equal(boosted.accessed, 3);
    });

    test("works without context (no tag added)", () => {
      const frag = core.createFragment("test", "ai");
      const boosted = core.boostOnAccess(frag);
      assert.deepEqual(boosted.tags, []);
    });
  });

  // ── recordNegativeHit ──────────────────────────────────────────────

  describe("recordNegativeHit", () => {
    test("decreases confidence by 0.1", () => {
      const frag = { ...core.createFragment("test", "ai"), confidence: 0.8 };
      const penalized = core.recordNegativeHit(frag);
      assert.ok(Math.abs(penalized.confidence - 0.7) < 0.001);
    });

    test("never goes below 0", () => {
      const frag = { ...core.createFragment("test", "ai"), confidence: 0.05 };
      const penalized = core.recordNegativeHit(frag);
      assert.equal(penalized.confidence, 0);
    });

    test("increments negativeHits", () => {
      const frag = { ...core.createFragment("test", "ai"), negativeHits: 1 };
      const penalized = core.recordNegativeHit(frag);
      assert.equal(penalized.negativeHits, 2);
    });
  });

  // ── trackAssociations ──────────────────────────────────────────────

  describe("trackAssociations", () => {
    test("creates bidirectional associations", () => {
      const frags = [
        core.createFragment("a", "ai"),
        core.createFragment("b", "ai"),
      ];
      core.trackAssociations(frags, frags[0].id, [frags[1].id]);
      assert.ok(frags[0].associatedWith.includes(frags[1].id));
      assert.ok(frags[1].associatedWith.includes(frags[0].id));
    });

    test("does not associate with self", () => {
      const frag = core.createFragment("solo", "ai");
      core.trackAssociations([frag], frag.id, [frag.id]);
      assert.equal(frag.associatedWith.length, 0);
    });

    test("does not duplicate associations", () => {
      const frags = [
        core.createFragment("a", "ai"),
        core.createFragment("b", "ai"),
      ];
      core.trackAssociations(frags, frags[0].id, [frags[1].id]);
      core.trackAssociations(frags, frags[0].id, [frags[1].id]);
      assert.equal(frags[0].associatedWith.length, 1);
    });

    test("handles empty sessionIds gracefully", () => {
      const frag = core.createFragment("solo", "ai");
      core.trackAssociations([frag], frag.id, []);
      assert.equal(frag.associatedWith.length, 0);
    });

    test("handles non-existent IDs gracefully", () => {
      const frag = core.createFragment("solo", "ai");
      core.trackAssociations([frag], frag.id, ["nonexistent"]);
      assert.equal(frag.associatedWith.length, 1);
    });
  });

  // ── searchAndSortFragments ─────────────────────────────────────────

  describe("searchAndSortFragments", () => {
    test("sorts by confidence when no query", () => {
      const frags = [
        { ...core.createFragment("low", "ai"), confidence: 0.3 },
        { ...core.createFragment("high", "ai"), confidence: 0.9 },
      ];
      const sorted = core.searchAndSortFragments(frags, null, 10);
      assert.equal(sorted[0].confidence, 0.9);
    });

    test("respects topK limit", () => {
      const frags = Array.from({ length: 50 }, (_, i) =>
        core.createFragment(`frag-${i}`, "ai")
      );
      const sorted = core.searchAndSortFragments(frags, null, 10);
      assert.equal(sorted.length, 10);
    });

    test("fuzzy search returns relevant results", () => {
      const frags = [
        core.createFragment("react component patterns", "ai"),
        core.createFragment("python data analysis", "ai"),
      ];
      const results = core.searchAndSortFragments(frags, "react", 10);
      assert.ok(results.length >= 1);
      assert.ok(results[0].fragment.includes("react"));
    });

    test("updates lastAccessed on returned fragments", () => {
      const frag = core.createFragment("test", "ai");
      const oldAccessed = frag.lastAccessed;
      // Tiny delay to ensure different timestamp
      const results = core.searchAndSortFragments([frag], null, 10);
      assert.ok(results[0].lastAccessed >= oldAccessed);
    });
  });

  // ── formatMemoryForLLM ─────────────────────────────────────────────

  describe("formatMemoryForLLM", () => {
    test("shows empty state when no fragments", () => {
      const output = core.formatMemoryForLLM([]);
      assert.ok(output.includes("no active fragments"));
    });

    test("includes confidence bar", () => {
      const frag = { ...core.createFragment("test", "ai"), confidence: 0.8 };
      const output = core.formatMemoryForLLM([frag]);
      assert.ok(output.includes("████"));
      assert.ok(output.includes("░"));
    });

    test("shows source icon", () => {
      const ai = core.createFragment("ai", "ai");
      const user = core.createFragment("user", "user");
      const output = core.formatMemoryForLLM([ai, user]);
      assert.ok(output.includes("🤖"));
      assert.ok(output.includes("👤"));
    });

    test("shows project scope tag", () => {
      const frag = core.createFragment("test", "ai", "T", "myproj");
      const output = core.formatMemoryForLLM([frag]);
      assert.ok(output.includes("[myproj]"));
    });
  });

  // ── formatMemoryDetail ─────────────────────────────────────────────

  describe("formatMemoryDetail", () => {
    test("returns not-found message for null", () => {
      assert.equal(core.formatMemoryDetail(null), "Fragment not found.");
    });

    test("includes tags when present", () => {
      const frag = { ...core.createFragment("test", "ai"), tags: ["debugging", "react"] };
      const output = core.formatMemoryDetail(frag);
      assert.ok(output.includes("Tags: debugging, react"));
    });

    test("includes associations when present", () => {
      const frag = { ...core.createFragment("test", "ai"), associatedWith: ["mabc123"] };
      const output = core.formatMemoryDetail(frag);
      assert.ok(output.includes("Related: mabc123"));
    });

    test("omits tags line when empty", () => {
      const frag = core.createFragment("test", "ai");
      const output = core.formatMemoryDetail(frag);
      assert.ok(!output.includes("Tags:"));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GUIDES CORE
// ═══════════════════════════════════════════════════════════════════════

describe("Guides Core", () => {

  describe("createGuide", () => {
    test("creates guide with required fields", () => {
      const g = guides.createGuide("react", "web-frontend", "React library");
      assert.ok(g.id.startsWith("g"));
      assert.equal(g.guide, "react");
      assert.equal(g.category, "web-frontend");
      assert.equal(g.usage_count, 1);
      assert.deepEqual(g.contexts, []);
      assert.deepEqual(g.learnings, []);
    });

    test("normalizes name and category to lowercase", () => {
      const g = guides.createGuide("React", "WEB-FRONTEND", "desc");
      assert.equal(g.guide, "react");
      assert.equal(g.category, "web-frontend");
    });
  });

  describe("loadGuides / saveGuides", () => {
    test("returns empty array when no file", () => {
      assert.deepEqual(guides.loadGuides(), []);
    });

    test("persists and loads guides", () => {
      const gs = [guides.createGuide("react", "web-frontend", "React guide")];
      guides.saveGuides(gs);
      const loaded = guides.loadGuides();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].guide, "react");
    });

    test("refuses to save empty array", () => {
      const gs = [guides.createGuide("seed", "dev-tool", "desc")];
      guides.saveGuides(gs);
      guides.saveGuides([]);
      assert.equal(guides.loadGuides().length, 1);
    });
  });

  describe("findGuide", () => {
    test("finds guide case-insensitively", () => {
      const gs = [guides.createGuide("React", "web-frontend", "desc")];
      assert.ok(guides.findGuide(gs, "react"));
      assert.ok(guides.findGuide(gs, "REACT"));
    });

    test("returns null for non-existent guide", () => {
      assert.equal(guides.findGuide([], "nothing"), null);
    });
  });

  describe("practiceGuide", () => {
    test("increments usage count for existing guide", () => {
      const gs = [guides.createGuide("react", "web-frontend", "desc")];
      guides.practiceGuide(gs, "react", "web-frontend", "", ["hooks"], ["useCallback"]);
      assert.equal(gs[0].usage_count, 2);
      assert.deepEqual(gs[0].contexts, ["hooks"]);
      assert.deepEqual(gs[0].learnings, ["useCallback"]);
    });

    test("creates new guide if not found", () => {
      const gs = [];
      guides.practiceGuide(gs, "python", "programming-language", "Python guide", ["scripts"], ["list comprehension"]);
      assert.equal(gs.length, 1);
      assert.equal(gs[0].guide, "python");
    });
  });

  describe("deleteGuide", () => {
    test("removes guide by name", () => {
      const gs = [guides.createGuide("react", "web-frontend", "desc")];
      const result = guides.deleteGuide(gs, "react");
      assert.equal(result, true);
      assert.equal(gs.length, 0);
    });

    test("returns false for non-existent guide", () => {
      const result = guides.deleteGuide([], "nothing");
      assert.equal(result, false);
    });
  });

  describe("promoteToGuide", () => {
    test("creates new guide from memory", () => {
      const gs = [];
      guides.promoteToGuide(gs, "react", "web-frontend", "use hooks", "component");
      assert.equal(gs.length, 1);
      assert.deepEqual(gs[0].learnings, ["use hooks"]);
    });

    test("adds learning to existing guide", () => {
      const gs = [guides.createGuide("react", "web-frontend", "desc")];
      guides.promoteToGuide(gs, "react", "web-frontend", "useReducer pattern", "state");
      assert.ok(gs[0].learnings.includes("useReducer pattern"));
      assert.equal(gs[0].usage_count, 2);
    });
  });

  describe("suggestGuides", () => {
    test("returns suggestions for a task", () => {
      const result = guides.suggestGuides("react", []);
      assert.ok(result.summary.includes("relevant"));
      assert.ok(result.suggested.length > 0);
    });

    test("finds tracked guides", () => {
      const gs = [guides.createGuide("react", "web-frontend", "desc", ["hooks", "state"])];
      const result = guides.suggestGuides("react", gs);
      assert.ok(result.relevant.length > 0);
    });
  });

  describe("formatGuidesForLLM", () => {
    test("shows empty state", () => {
      const output = guides.formatGuidesForLLM([]);
      assert.ok(output.includes("no guides tracked"));
    });

    test("shows guide details", () => {
      const gs = [guides.createGuide("react", "web-frontend", "desc", ["hooks"], ["useCallback"])];
      const output = guides.formatGuidesForLLM(gs);
      assert.ok(output.includes("react"));
      assert.ok(output.includes("1 learnings"));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HANDLERS (Integration — uses real I/O via temp dir)
// ═══════════════════════════════════════════════════════════════════════

// Shared seed helper
function seedMemory() {
  const frags = [core.createFragment("react hooks pattern", "ai", "React Hooks", "testproj")];
  core.saveMemory(frags);
  return frags[0];
}

describe("Handlers (Integration)", () => {

  // ── memory_read ────────────────────────────────────────────────────

  describe("handleMemoryCheck", () => {
    test("returns empty when no memory for project", async () => {
      const result = await handlers.handleMemoryCheck({ project: "nonexistent" });
      assert.ok(result.content[0].text.includes("No memory found"));
    });

    test("returns summary when memory exists", async () => {
      seedMemory();
      const result = await handlers.handleMemoryCheck({ project: "testproj" });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("Found 1"));
      assert.ok(result.content[0].text.includes("testproj"));
    });

    test("matches project case-insensitively", async () => {
      // seedMemory creates with "testproj" — search with different case
      seedMemory();
      const result = await handlers.handleMemoryCheck({ project: "TESTPROJ" });
      assert.ok(result.content[0].text.includes("Found 1"));
    });
  });

  describe("handleMemoryRead", () => {
    test("returns summary list", async () => {
      seedMemory();
      const result = await handlers.handleMemoryRead({ project: "testproj" });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("LEMM"));
    });

    test("returns detail by ID with boost", async () => {
      const frag = seedMemory();
      const result = await handlers.handleMemoryRead({ id: frag.id, context: "debugging" });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("CONTENT"));

      // Verify boost was persisted
      const loaded = core.loadMemory();
      const updated = loaded.find(f => f.id === frag.id);
      assert.ok(updated.tags.includes("debugging"));
      assert.ok(updated.confidence >= 1.0); // was already 1.0, should be capped
      assert.ok(updated.accessed >= 1);
    });

    test("returns error for unknown ID", async () => {
      const result = await handlers.handleMemoryRead({ id: "nonexistent" });
      assert.equal(result.isError, true);
    });
  });

  // ── memory_add ────────────────────────────────────────────────────

  describe("handleMemoryAdd", () => {
    test("adds a new fragment", async () => {
      // Seed so saveMemory doesn't refuse empty array
      seedMemory();
      const result = await handlers.handleMemoryAdd({
        fragment: "new knowledge",
        title: "New",
        project: "testproj",
      });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("Added"));

      const loaded = core.loadMemory();
      assert.equal(loaded.length, 2);
    });

    test("rejects duplicate (similar) fragments", async () => {
      seedMemory();
      const result = await handlers.handleMemoryAdd({
        fragment: "react hooks pattern",
        project: "testproj",
      });
      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes("similar"));
    });

    test("requires fragment parameter", async () => {
      const result = await handlers.handleMemoryAdd({});
      assert.equal(result.isError, true);
    });
  });

  // ── memory_update ─────────────────────────────────────────────────

  describe("handleMemoryUpdate", () => {
    test("updates title", async () => {
      const frag = seedMemory();
      const result = await handlers.handleMemoryUpdate({
        id: frag.id,
        title: "Updated Title",
      });
      assert.ok(!result.isError);
      const loaded = core.loadMemory().find(f => f.id === frag.id);
      assert.equal(loaded.title, "Updated Title");
    });

    test("returns error for unknown ID", async () => {
      const result = await handlers.handleMemoryUpdate({ id: "nope" });
      assert.equal(result.isError, true);
    });
  });

  // ── memory_forget ─────────────────────────────────────────────────

  describe("handleMemoryForget", () => {
    test("removes a fragment", async () => {
      const frag = seedMemory();
      const result = await handlers.handleMemoryForget({ id: frag.id });
      assert.ok(!result.isError);
      assert.equal(core.loadMemory().length, 0);
    });

    test("returns error for unknown ID", async () => {
      const result = await handlers.handleMemoryForget({ id: "nope" });
      assert.equal(result.isError, true);
    });
  });

  // ── memory_feedback ───────────────────────────────────────────────

  describe("handleMemoryFeedback", () => {
    test("positive feedback boosts confidence", async () => {
      const frag = { ...seedMemory(), confidence: 0.5 };
      core.saveMemory([frag]);

      const result = await handlers.handleMemoryFeedback({
        id: frag.id,
        useful: true,
      });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("Positive"));

      const loaded = core.loadMemory().find(f => f.id === frag.id);
      assert.equal(loaded.confidence, 0.6);
    });

    test("negative feedback reduces confidence", async () => {
      const frag = { ...seedMemory(), confidence: 0.8 };
      core.saveMemory([frag]);

      const result = await handlers.handleMemoryFeedback({
        id: frag.id,
        useful: false,
      });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("Negative"));

      const loaded = core.loadMemory().find(f => f.id === frag.id);
      assert.ok(Math.abs(loaded.confidence - 0.7) < 0.001);
      assert.equal(loaded.negativeHits, 1);
    });

    test("returns error for unknown ID", async () => {
      const result = await handlers.handleMemoryFeedback({ id: "nope", useful: true });
      assert.equal(result.isError, true);
    });

    test("returns error when useful is missing", async () => {
      const frag = seedMemory();
      const result = await handlers.handleMemoryFeedback({ id: frag.id });
      assert.equal(result.isError, true);
    });
  });

  // ── memory_merge ──────────────────────────────────────────────────

  describe("handleMemoryMerge", () => {
    test("merges two fragments", async () => {
      const f1 = core.createFragment("aaa", "ai", "A", "testproj");
      const f2 = core.createFragment("bbb", "ai", "B", "testproj");
      core.saveMemory([f1, f2]);

      const result = await handlers.handleMemoryMerge({
        ids: [f1.id, f2.id],
        title: "Merged",
        fragment: "aaa and bbb combined",
      });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("Merged 2"));

      // After merge: old fragments removed, new merged fragment added
      const loaded = core.loadMemory();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].title, "Merged");
      assert.equal(loaded[0].fragment, "aaa and bbb combined");
    });
  });

  // ── guide_practice ────────────────────────────────────────────────

  describe("handleGuidePractice", () => {
    test("records guide usage", async () => {
      const result = await handlers.handleGuidePractice({
        guide: "react",
        category: "web-frontend",
        contexts: ["hooks"],
        learnings: ["useCallback prevents re-renders"],
      });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("Created"));

      const loaded = guides.loadGuides();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].usage_count, 1);
    });

    test("returns error without required params", async () => {
      const result = await handlers.handleGuidePractice({});
      assert.equal(result.isError, true);
    });
  });

  // ── guide_create ──────────────────────────────────────────────────

  describe("handleGuideCreate", () => {
    test("creates a guide with manual", async () => {
      const result = await handlers.handleGuideCreate({
        guide: "tdd",
        category: "dev-tool",
        description: "Test Driven Development workflow",
      });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("Created"));

      const loaded = guides.loadGuides();
      assert.equal(loaded[0].description, "Test Driven Development workflow");
    });
  });

  // ── guide_distill ─────────────────────────────────────────────────

  describe("handleGuideDistill", () => {
    test("distills memory into guide", async () => {
      const frag = seedMemory();

      const result = await handlers.handleGuideDistill({
        memory_id: frag.id,
        guide: "react",
        category: "web-frontend",
      });
      assert.ok(!result.isError);
      assert.ok(result.content[0].text.includes("distilled"));

      const loaded = guides.loadGuides();
      assert.equal(loaded.length, 1);
      assert.ok(loaded[0].learnings.includes("react hooks pattern"));
    });
  });

  // ── guide_forget ──────────────────────────────────────────────────

  describe("handleGuideForget", () => {
    test("removes a guide", async () => {
      const gs = [guides.createGuide("react", "web-frontend", "desc")];
      guides.saveGuides(gs);

      const result = await handlers.handleGuideForget({ guide: "react" });
      assert.ok(!result.isError);
      assert.equal(guides.loadGuides().length, 0);
    });
  });

  // ── handleCallTool (dispatch) ─────────────────────────────────────

  describe("handleCallTool", () => {
    test("dispatches memory_read", async () => {
      seedMemory();
      const result = await handlers.handleCallTool({
        params: { name: "memory_read", arguments: { project: "testproj" } }
      });
      assert.ok(!result.isError);
    });

    test("returns error for unknown tool", async () => {
      const result = await handlers.handleCallTool({
        params: { name: "nonexistent_tool", arguments: {} }
      });
      assert.equal(result.isError, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LEARNING SYSTEM (Boost → Decay → Feedback lifecycle)
// ═══════════════════════════════════════════════════════════════════════

describe("Learning System Lifecycle", () => {
  test("fragment gains strength through repeated use", () => {
    // Start with decayed fragment
    const frag = { ...core.createFragment("useful pattern", "ai"), confidence: 0.5, accessed: 0 };

    // Simulate 3 uses in a session
    let boosted = core.boostOnAccess(frag, "debugging");
    boosted = core.boostOnAccess(boosted, "refactoring");
    boosted = core.boostOnAccess(boosted, "debugging"); // same tag — no duplicate

    assert.ok(Math.abs(boosted.confidence - 0.8) < 0.001);
    assert.deepEqual(boosted.tags, ["debugging", "refactoring"]);
    assert.equal(boosted.accessed, 3);
  });

  test("negative feedback does not affect decay rate", () => {
    const good = { ...core.createFragment("good", "ai"), confidence: 0.8, accessed: 0, negativeHits: 0 };
    const bad = { ...core.createFragment("bad", "ai"), confidence: 0.8, accessed: 0, negativeHits: 3 };

    const [decayedGood] = core.decayConfidence([good]);
    const [decayedBad] = core.decayConfidence([bad]);

    assert.equal(decayedGood.confidence, decayedBad.confidence,
      "negativeHits should not affect decay rate");
  });

  test("boost + decay equilibrium: frequent use sustains confidence", () => {
    let frag = { ...core.createFragment("popular", "ai"), confidence: 1.0, accessed: 0 };

    // Simulate many cycles: boost then decay
    for (let i = 0; i < 10; i++) {
      frag = core.boostOnAccess(frag, "daily-use");
      frag = core.decayConfidence([frag])[0];
    }

    // A fragment used every cycle should retain high confidence
    assert.ok(frag.confidence > 0.7,
      `Frequently used fragment should stay strong, got ${frag.confidence}`);
    assert.deepEqual(frag.tags, ["daily-use"]);
  });

  test("unused fragment decays to near zero", () => {
    let frag = { ...core.createFragment("forgotten", "ai"), confidence: 1.0, accessed: 0 };

    for (let i = 0; i < 30; i++) {
      frag = core.decayConfidence([frag])[0];
    }

    assert.ok(frag.confidence < 0.1,
      `Unused fragment should decay significantly, got ${frag.confidence}`);
  });

  test("associations track co-accessed fragments", () => {
    const frags = [
      core.createFragment("error handling", "ai"),
      core.createFragment("try-catch pattern", "ai"),
      core.createFragment("logging", "ai"),
    ];

    // Simulate a session where all three were accessed together
    core.trackAssociations(frags, frags[0].id, [frags[1].id, frags[2].id]);
    core.trackAssociations(frags, frags[1].id, [frags[0].id, frags[2].id]);

    assert.ok(frags[0].associatedWith.length >= 2);
    assert.ok(frags[1].associatedWith.length >= 2);
    assert.ok(frags[2].associatedWith.includes(frags[0].id));
  });

  test("full lifecycle: add → read (boost) → feedback → decay", async () => {
    // Add
    seedMemory();
    let loaded = core.loadMemory();
    const fragId = loaded[0].id;

    // Read with context (boosts)
    await handlers.handleMemoryRead({ id: fragId, context: "bugfix" });

    loaded = core.loadMemory();
    let frag = loaded.find(f => f.id === fragId);
    assert.ok(frag.tags.includes("bugfix"));

    // Positive feedback
    await handlers.handleMemoryFeedback({ id: fragId, useful: true });

    // Decay cycle
    loaded = core.loadMemory();
    frag = loaded.find(f => f.id === fragId);
    const decayed = core.decayConfidence([frag])[0];

    // Confidence should still be high after boost + decay
    assert.ok(decayed.confidence > 0.8,
      `Confidence should remain high after boost, got ${decayed.confidence}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HOOK SYSTEM
// ═══════════════════════════════════════════════════════════════════════

describe("Hook System", () => {
  beforeEach(() => {
    hooks.clearHooks();
  });

  describe("registerHook", () => {
    test("registers a hook callback", () => {
      const unregister = hooks.registerHook(hooks.HookTypes.ON_START, async () => {});
      assert.equal(hooks.getHookCount(hooks.HookTypes.ON_START), 1);
      unregister();
    });

    test("returns unregister function", () => {
      const unregister = hooks.registerHook(hooks.HookTypes.ON_START, async () => {});
      unregister();
      assert.equal(hooks.getHookCount(hooks.HookTypes.ON_START), 0);
    });

    test("throws for unknown hook type", () => {
      assert.throws(() => {
        hooks.registerHook("unknown_type", async () => {});
      });
    });
  });

  describe("triggerHook", () => {
    test("calls all registered callbacks", async () => {
      let callCount = 0;
      hooks.registerHook(hooks.HookTypes.ON_START, async () => { callCount++; });
      hooks.registerHook(hooks.HookTypes.ON_START, async () => { callCount++; });

      await hooks.triggerHook(hooks.HookTypes.ON_START, { project: "test" });
      assert.equal(callCount, 2);
    });

    test("passes context to callbacks", async () => {
      let receivedContext = null;
      hooks.registerHook(hooks.HookTypes.ON_START, async (ctx) => {
        receivedContext = ctx;
      });

      await hooks.triggerHook(hooks.HookTypes.ON_START, { project: "MyProject" });
      assert.equal(receivedContext.project, "MyProject");
    });

    test("returns results from all callbacks", async () => {
      hooks.registerHook(hooks.HookTypes.ON_START, async () => "result1");
      hooks.registerHook(hooks.HookTypes.ON_START, async () => "result2");

      const results = await hooks.triggerHook(hooks.HookTypes.ON_START, {});
      assert.deepEqual(results, ["result1", "result2"]);
    });

    test("handles callback errors gracefully", async () => {
      hooks.registerHook(hooks.HookTypes.ON_START, async () => { throw new Error("fail"); });
      hooks.registerHook(hooks.HookTypes.ON_START, async () => "success");

      const results = await hooks.triggerHook(hooks.HookTypes.ON_START, {});
      assert.equal(results[0].error, "fail");
      assert.equal(results[1], "success");
    });
  });

  describe("clearHooks", () => {
    test("removes all hooks", () => {
      hooks.registerHook(hooks.HookTypes.ON_START, async () => {});
      hooks.registerHook(hooks.HookTypes.ON_PROJECT_CHANGE, async () => {});
      hooks.clearHooks();
      assert.equal(hooks.getHookCount(hooks.HookTypes.ON_START), 0);
      assert.equal(hooks.getHookCount(hooks.HookTypes.ON_PROJECT_CHANGE), 0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DYNAMIC SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════

describe("Dynamic System Prompt", () => {
  // Helper to seed project-specific memories
  function seedProjectMemory(projectName) {
    const frags = [
      core.createFragment("React hooks patterns", "ai", "React Hooks", projectName),
      core.createFragment("State management tips", "ai", "State Mgmt", projectName),
    ];
    core.saveMemory(frags);
    return frags;
  }

  describe("getDynamicSystemPrompt", () => {
    test("returns base prompt when no project", () => {
      const prompt = getDynamicSystemPrompt(null);
      assert.ok(prompt.includes("Lemma — Persistent Memory Layer"));
      assert.ok(!prompt.includes("<project_context>"));
    });

    test("returns base prompt when project has no memories", () => {
      const prompt = getDynamicSystemPrompt("EmptyProject");
      assert.ok(prompt.includes("Lemma — Persistent Memory Layer"));
      assert.ok(!prompt.includes("<project_context>"));
    });

    test("injects project context when memories exist", () => {
      seedProjectMemory("TestProject");
      const prompt = getDynamicSystemPrompt("TestProject");
      assert.ok(prompt.includes("<project_context>"));
      assert.ok(prompt.includes("Project Context: TestProject"));
      assert.ok(prompt.includes("2 saved memory fragment"));
    });

    test("includes memory titles in injected context", () => {
      seedProjectMemory("AnotherProject");
      const prompt = getDynamicSystemPrompt("AnotherProject");
      assert.ok(prompt.includes("React Hooks"));
      assert.ok(prompt.includes("State Mgmt"));
    });

    test("only includes project-scoped memories (not global)", () => {
      // Create global memory with unique title
      const globalFrag = core.createFragment("Global unique info xyz", "ai", "GlobalUniqueTitle", null);
      // Create project memory
      const projFrag = core.createFragment("Project unique info", "ai", "ProjectUniqueTitle", "ScopedProj");
      core.saveMemory([globalFrag, projFrag]);

      const prompt = getDynamicSystemPrompt("ScopedProj");
      assert.ok(prompt.includes("ProjectUniqueTitle"), "Should include project memory");
      assert.ok(!prompt.includes("GlobalUniqueTitle"), "Should NOT include global memory");
    });

    test("limits to top 20 fragments by confidence", () => {
      // Create 25 fragments with varying confidence
      const frags = [];
      for (let i = 0; i < 25; i++) {
        const frag = core.createFragment(`Fragment ${i}`, "ai", `Title ${i}`, "BigProject");
        frag.confidence = 0.3 + (i * 0.02); // Varying confidence
        frags.push(frag);
      }
      core.saveMemory(frags);

      const prompt = getDynamicSystemPrompt("BigProject");
      // Count how many fragment IDs appear in the output
      const matches = prompt.match(/\[m[a-f0-9]{6}\]/g) || [];
      assert.ok(matches.length <= 20, `Expected max 20 fragments, got ${matches.length}`);
    });

    test("project name matching is case-insensitive", () => {
      seedProjectMemory("CaseSensitive");
      const prompt = getDynamicSystemPrompt("casesensitive");
      assert.ok(prompt.includes("<project_context>"));
    });
  });
});
