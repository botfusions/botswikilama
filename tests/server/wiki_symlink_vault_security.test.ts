import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki tools should block symbolic link traversal at the vault root level", async () => {
  const homeDir = os.homedir();
  const tmpDir = fs.mkdtempSync(path.join(homeDir, "lemma-vault-symlink-test-"));
  const realVaultPath = path.join(tmpDir, "real_vault");
  const symlinkVaultPath = path.join(tmpDir, "symlink_vault");
  const externalSecretVaultPath = path.join(tmpDir, "..", "secret_external_vault");

  try {
    // Ensure parent and directories exist
    fs.mkdirSync(realVaultPath, { recursive: true });

    // Scenario A: Symlink pointing to a safe path inside home directory
    // This should succeed
    fs.symlinkSync(realVaultPath, symlinkVaultPath);
    const setupResult = await handleWikiSetup({ vault_path: symlinkVaultPath });
    assert.strictEqual(setupResult.isError, undefined, "Symlink inside home directory should be allowed");

    // Scenario B: Symlink pointing outside home directory (traversal via symlink)
    // Create a symlink pointing to an unsafe directory outside home directory
    // To reliably test "outside home directory" within sandboxed test runners:
    // os.homedir() is the boundary. We can create a symlink that resolves to os.homedir()/..
    const outsidePath = path.resolve(homeDir, "..");
    const maliciousSymlinkPath = path.join(tmpDir, "malicious_symlink");

    try {
      fs.symlinkSync(outsidePath, maliciousSymlinkPath);
    } catch (e: any) {
      console.warn("Could not create malicious symlink, skipping unsafe part:", e.message);
      return;
    }

    const maliciousResult = await handleWikiSetup({ vault_path: maliciousSymlinkPath });
    assert.strictEqual(maliciousResult.isError, true, "Symlink pointing outside home directory must be blocked");
    assert.match(maliciousResult.content[0].text, /Access denied/, "Error message should state Access denied");

    // Scenario C: Non-existent vault path with a parent directory that is a symlink pointing outside home directory
    const maliciousSubPath = path.join(maliciousSymlinkPath, "new_vault");
    const maliciousSubResult = await handleWikiSetup({ vault_path: maliciousSubPath });
    assert.strictEqual(maliciousSubResult.isError, true, "Non-existent path with parent symlink pointing outside home directory must be blocked");
    assert.match(maliciousSubResult.content[0].text, /Access denied/, "Error message should state Access denied");

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }
});
