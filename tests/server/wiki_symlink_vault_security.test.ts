import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki tools should block symbolic links pointing outside home directory as vault_path", async () => {
  const homeDir = os.homedir();
  const tmpDir = fs.mkdtempSync(path.join(homeDir, "lemma-symlink-test-"));
  const sneakyTarget = fs.mkdtempSync(path.join(os.tmpdir(), "sneaky-symlink-target-"));

  const symlinkVault = path.join(tmpDir, "vault_symlink");

  try {
    // 1. Create a symlink inside the home directory pointing to a directory outside the home directory (in /tmp)
    try {
      fs.symlinkSync(sneakyTarget, symlinkVault, "dir");
    } catch (e) {
      console.error("Symlink creation failed, skipping symlink-specific test part:", (e as any).message);
      return;
    }

    // 2. Try to setup the vault with this symlinked path.
    // Since the symlink points outside os.homedir(), it should throw an Access Denied error.
    const result = await handleWikiSetup({ vault_path: symlinkVault });

    assert.strictEqual(result.isError, true);
    assert.match(result.content[0].text, /Access denied: Path must be within home directory/);

  } finally {
    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    try {
      fs.rmSync(sneakyTarget, { recursive: true, force: true });
    } catch {}
  }
});
