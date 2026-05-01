import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as handlers from "../../src/server/handlers.js";

describe("Wiki Security - Path Traversal", () => {
  let TMPDIR: string;

  beforeEach(() => {
    TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-security-test-"));
  });

  afterEach(() => {
    fs.rmSync(TMPDIR, { recursive: true, force: true });
  });

  test("wiki_setup blocks path traversal", async () => {
    const vaultPath = path.join("/tmp", "unsafe_vault");

    const result = await handlers.handleWikiSetup({
      vault_path: vaultPath,
      project_name: "SecurityTest"
    });

    assert.strictEqual(result.isError, true, "Should have failed because /tmp is outside home");
    assert.ok(result.content[0].text.includes("Invalid vault path"), "Error message should mention invalid path");
  });

  test("wiki_ingest blocks path traversal via vault_path", async () => {
    const vaultPath = path.join("/etc", "shadow");

    const result = await handlers.handleWikiIngest({
      vault_path: vaultPath,
      title: "Traversal",
      summary: "Testing traversal"
    });

    assert.strictEqual(result.isError, true, "Should have failed");
    assert.ok(result.content[0].text.includes("Invalid vault path"), "Error message should mention invalid path");
  });

  test("wiki_ingest allows external file_path (intended behavior)", async () => {
    const vaultPath = path.join(os.homedir(), "my_wiki_" + Date.now());
    fs.mkdirSync(vaultPath, { recursive: true });
    fs.writeFileSync(path.join(vaultPath, "index.md"), "# Index");

    const externalFilePath = path.join(os.homedir(), "some_project", "readme.md");

    try {
      const result = await handlers.handleWikiIngest({
        vault_path: vaultPath,
        file_path: externalFilePath,
        title: "External Source",
        summary: "Testing external source reference"
      });

      assert.strictEqual(result.isError, undefined, "Should have succeeded as file_path is just metadata");
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  test("wiki_setup blocks path traversal using ..", async () => {
    // Manually construct the string with .. to avoid path.join normalization
    const vaultPath = os.homedir() + "/safe_dir/../unsafe_vault";

    const result = await handlers.handleWikiSetup({
      vault_path: vaultPath,
      project_name: "SecurityTest"
    });

    assert.strictEqual(result.isError, true, "Should have failed because of ..");
    assert.ok(result.content[0].text.includes("Invalid vault path"), "Error message should mention invalid path");
  });
});
