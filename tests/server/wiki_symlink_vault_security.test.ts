import { test, describe } from "node:test";
import assert from "node:assert";
import { handleWikiSetup } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

describe("Wiki Symlink Vault Path Traversal Security", () => {
  test("wiki_setup should reject vault_path containing symlink to outside home directory", async () => {
    const homeDir = os.homedir();
    const tmpHomeDir = fs.mkdtempSync(path.join(homeDir, "lemma-test-vault-"));
    const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-external-dir-"));

    const symlinkPath = path.join(tmpHomeDir, "sneaky_symlink");

    try {
      // Create a symlink in the home directory pointing outside the home directory
      fs.symlinkSync(externalDir, symlinkPath);

      const targetVaultPath = path.join(symlinkPath, "my_vault");

      // Attempt to run wiki_setup with vault_path traversing through the symlink to outside home
      const result = await handleWikiSetup({
        vault_path: targetVaultPath,
        project_name: "test-vault",
        language: "Türkçe"
      });

      // It should be blocked with Access denied error
      assert.strictEqual(result.isError, true);
      assert.match(result.content[0].text, /Access denied/);

    } finally {
      // Cleanup
      try {
        fs.unlinkSync(symlinkPath);
      } catch {}
      try {
        fs.rmSync(tmpHomeDir, { recursive: true, force: true });
      } catch {}
      try {
        fs.rmSync(externalDir, { recursive: true, force: true });
      } catch {}
    }
  });
});
