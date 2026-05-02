import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as handlers from "../../src/server/handlers.js";

describe("Wiki Security", () => {
  test("wiki_setup should prevent path traversal", async () => {
    // Attempt to create a vault outside of allowed directory
    // We'll try to use '..' to go above the home directory or into sensitive areas
    // For the test, we'll just check if it rejects paths with '..'
    const result = await handlers.handleWikiSetup({
      vault_path: "../traversal_test",
      project_name: "SecurityTest"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Security Error") || result.content[0].text.includes("Invalid path"));
  });

  test("wiki_query should prevent path traversal", async () => {
    const result = await handlers.handleWikiQuery({
      vault_path: "../traversal_test",
      query: "test"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Security Error") || result.content[0].text.includes("Invalid path"));
  });

  test("wiki_lint should prevent path traversal", async () => {
    const result = await handlers.handleWikiLint({
      vault_path: "../traversal_test"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Security Error") || result.content[0].text.includes("Invalid path"));
  });

  test("wiki_ingest should prevent path traversal", async () => {
    const result = await handlers.handleWikiIngest({
      vault_path: "../traversal_test",
      summary: "test"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Security Error") || result.content[0].text.includes("Invalid path"));
  });
});
