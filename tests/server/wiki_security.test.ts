import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as handlers from "../../src/server/handlers.js";
import os from "os";
import path from "path";

describe("Wiki Security — Path Traversal Protection", () => {
  const homeDir = os.homedir();

  test("wiki_setup blocks path with '..'", async () => {
    const vaultPath = homeDir + "/../traversal"; // Avoid path.join normalization
    const result = await handlers.handleWikiSetup({
      vault_path: vaultPath
    });
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("path traversal sequences are not allowed") ||
              result.content[0].text.includes("must be within your home directory"));
  });

  test("wiki_setup blocks path outside home directory", async () => {
    // This assumes /tmp is outside homedir on most systems where this runs,
    // but to be safe we use a path that is definitely not in homedir if possible.
    const rootPath = os.platform() === 'win32' ? 'C:\\Windows' : '/etc';
    const result = await handlers.handleWikiSetup({
      vault_path: rootPath
    });
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("must be within your home directory"));
  });

  test("wiki_ingest blocks path traversal", async () => {
    const vaultPath = homeDir + "/../traversal";
    const result = await handlers.handleWikiIngest({
      vault_path: vaultPath,
      summary: "test"
    });
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("path traversal sequences are not allowed") ||
              result.content[0].text.includes("must be within your home directory"));
  });

  test("wiki_query blocks path traversal", async () => {
    const vaultPath = homeDir + "/../traversal";
    const result = await handlers.handleWikiQuery({
      vault_path: vaultPath,
      query: "test"
    });
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("path traversal sequences are not allowed") ||
              result.content[0].text.includes("must be within your home directory"));
  });

  test("wiki_lint blocks path traversal", async () => {
    const vaultPath = homeDir + "/../traversal";
    const result = await handlers.handleWikiLint({
      vault_path: vaultPath
    });
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("path traversal sequences are not allowed") ||
              result.content[0].text.includes("must be within your home directory"));
  });

  test("wiki_setup allows valid path within home directory", async () => {
    // We don't want to actually create a directory in the real home dir during tests
    // so we just verify it doesn't throw the traversal/homedir error before it tries to access the FS.
    // However, since handleWikiSetup will try to mkdir, we should use a temporary dir within homedir if possible,
    // or just mock/rely on the fact that the validation passes.

    // Actually, in the environment, we can probably use a path under homeDir and it should pass validation.
    const validPath = path.join(homeDir, ".lemma-test-vault");

    // We expect it might fail with "already exists" or actually try to create it.
    // If it fails with something OTHER than the validation errors, it means validation passed.
    const result = await handlers.handleWikiSetup({
      vault_path: validPath
    });

    // It should not be the traversal/homedir error
    assert.ok(!result.content[0].text.includes("path traversal sequences are not allowed"));
    assert.ok(!result.content[0].text.includes("must be within your home directory"));
  });
});
