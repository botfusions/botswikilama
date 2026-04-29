import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as handlers from "../../src/server/handlers.js";
import path from "path";
import os from "os";
import fs from "fs";

describe("Wiki Security - Path Traversal", () => {
  test("wiki_setup should block paths outside homedir", async () => {
    const unsafePath = path.join(os.tmpdir(), "lemma-unsafe-vault-" + Math.random().toString(36).substring(7));

    try {
      const result = await handlers.handleWikiSetup({
        vault_path: unsafePath,
        project_name: "UnsafeProject"
      });

      assert.strictEqual(result.isError, true, "Should have failed");
      assert.ok(result.content[0].text.includes("Vault path must be within the home directory"), "Error message should mention home directory");
      assert.ok(!fs.existsSync(path.join(unsafePath, "index.md")), "Vault should NOT have been created");
    } finally {
      if (fs.existsSync(unsafePath)) {
        fs.rmSync(unsafePath, { recursive: true, force: true });
      }
    }
  });

  test("wiki_setup should block path traversal with ..", async () => {
    const homeDir = os.homedir();
    const vaultPath = homeDir + "/.lemma/../unsafe-traversal-vault";

    const result = await handlers.handleWikiSetup({
      vault_path: vaultPath,
      project_name: "TraversalProject"
    });

    assert.strictEqual(result.isError, true, "Should have failed");
    assert.ok(result.content[0].text.includes("Path traversal (..) is not allowed"), "Error message should mention path traversal");

    const resolvedPath = path.resolve(vaultPath);
    // Important: check if it was created *after* the failed call.
    // We should probably clean up before the test.
    assert.ok(!fs.existsSync(path.join(resolvedPath, "index.md")), "Vault should NOT have been created");
  });

  test("wiki_setup should allow safe paths in homedir", async () => {
    const homeDir = os.homedir();
    const safePath = path.join(homeDir, ".lemma", "safe-vault-" + Math.random().toString(36).substring(7));

    try {
      const result = await handlers.handleWikiSetup({
        vault_path: safePath,
        project_name: "SafeProject"
      });

      assert.strictEqual(result.isError, undefined, "Should have succeeded");
      assert.ok(fs.existsSync(path.join(safePath, "index.md")), "Vault should have been created");
    } finally {
      if (fs.existsSync(safePath)) {
        fs.rmSync(safePath, { recursive: true, force: true });
      }
    }
  });

  test("wiki_ingest should block file_path prefix bypass", async () => {
    const homeDir = os.homedir();
    const vaultPath = path.join(homeDir, ".lemma", "my-vault");
    const secretPath = path.join(homeDir, ".lemma", "my-vault-secret");
    const secretFile = path.join(secretPath, "passwords.txt");

    if (!fs.existsSync(vaultPath)) fs.mkdirSync(vaultPath, { recursive: true });
    if (!fs.existsSync(secretPath)) fs.mkdirSync(secretPath, { recursive: true });
    fs.writeFileSync(path.join(vaultPath, "index.md"), "# Vault");
    fs.writeFileSync(secretFile, "secret_password");

    try {
      const result = await handlers.handleWikiIngest({
        vault_path: vaultPath,
        file_path: secretFile,
        summary: "Attempting to ingest secret file"
      });

      assert.strictEqual(result.isError, true, "Should have failed due to prefix mismatch");
      assert.ok(result.content[0].text.includes("file_path must be within the vault_path"));
    } finally {
      if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true, force: true });
      if (fs.existsSync(secretPath)) fs.rmSync(secretPath, { recursive: true, force: true });
    }
  });
});
