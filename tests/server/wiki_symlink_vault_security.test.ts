import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki tools should block symbolic link pointing outside home directory as vault_path", async () => {
  const homeDir = os.homedir();
  const tmpDir = fs.mkdtempSync(path.join(homeDir, "lemma-symlink-vault-test-"));
  const outsidePath = "/etc";
  const symlinkPath = path.join(tmpDir, "bad_vault_symlink");

  try {
    try {
      fs.symlinkSync(outsidePath, symlinkPath);
    } catch (e) {
      console.warn("Skipping symlink vault test: symlink creation failed", (e as any).message);
      return;
    }

    const result = await handleWikiSetup({ vault_path: symlinkPath });

    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Access denied: Path must be within home directory/);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
});
