import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as guides from "../../src/guides/index.js";

let TMPDIR;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-guide-suggest-"));
  guides.setGuidesDir(TMPDIR);
});

afterEach(() => {
  guides.setGuidesDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("suggestGuides", () => {
  test("returns suggestions from TASK_GUIDE_MAP for react component query", () => {
    const result = guides.suggestGuides("react component", []);
    assert.ok(result.suggested.length > 0);
    const names = result.suggested.map(s => s.guide);
    assert.ok(names.includes("react"));
  });

  test("returns suggestions from tracked guides via Fuse.js fuzzy search", () => {
    const gs = [guides.createGuide("custom-react-guide", "web-frontend", "desc", ["hooks"], ["useReducer pattern"])];
    const result = guides.suggestGuides("hooks useReducer", gs);
    const trackedNames = result.relevant.map(s => s.guide);
    assert.ok(trackedNames.includes("custom-react-guide"));
  });

  test("token-based fallback catches tracked guides Fuse misses", () => {
    const gs = [guides.createGuide("custom-unique-name-xyz", "dev-tool", "does something unique", ["specialcontext"], [])];
    const result = guides.suggestGuides("specialcontext", gs);
    const trackedNames = result.relevant.map(s => s.guide);
    assert.ok(trackedNames.includes("custom-unique-name-xyz"));
  });

  test("returns empty for completely unrelated query with no tracked guides", () => {
    const result = guides.suggestGuides("quantum physics", []);
    assert.equal(result.suggested.length, 0);
    assert.equal(result.relevant.length, 0);
    assert.equal(result.missing.length, 0);
  });

  test("handles empty string query gracefully", () => {
    const result = guides.suggestGuides("", []);
    assert.ok(result);
    assert.ok(Array.isArray(result.suggested));
    assert.ok(Array.isArray(result.relevant));
    assert.ok(Array.isArray(result.missing));
  });

  test("relevant and missing arrays are correctly separated", () => {
    const gs = [guides.createGuide("react", "web-frontend", "desc")];
    const result = guides.suggestGuides("react", gs);
    for (const r of result.relevant) {
      assert.equal(r.tracked, true);
    }
    for (const m of result.missing) {
      assert.equal(m.tracked, false);
    }
  });

  test("deduplicates: same guide does not appear twice in suggestions", () => {
    const gs = [guides.createGuide("react", "web-frontend", "desc", ["component"], ["hooks"])];
    const result = guides.suggestGuides("react component", gs);
    const names = result.suggested.map(s => s.guide);
    const uniqueNames = new Set(names);
    assert.equal(names.length, uniqueNames.size);
  });
});

describe("formatSuggestions", () => {
  test("shows tracked guides with checkmark", () => {
    const gs = [guides.createGuide("react", "web-frontend", "desc", [], ["useCallback"])];
    const result = guides.suggestGuides("react", gs);
    const output = guides.formatSuggestions(result);
    assert.ok(output.includes("✓"));
    assert.ok(output.includes("react"));
  });

  test("shows missing guides with plus sign", () => {
    const result = guides.suggestGuides("react component", []);
    if (result.missing.length > 0) {
      const output = guides.formatSuggestions(result);
      assert.ok(output.includes("+"));
    }
  });

  test("shows no-relevant message when no suggestions found", () => {
    const result = guides.suggestGuides("quantum physics", []);
    const output = guides.formatSuggestions(result);
    assert.ok(output.includes("No relevant guides found"));
  });

  test("includes summary line", () => {
    const result = guides.suggestGuides("react", []);
    const output = guides.formatSuggestions(result);
    assert.ok(output.includes(result.summary));
  });
});
