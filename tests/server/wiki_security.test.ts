import { test } from "node:test";
import assert from "node:assert";
import * as handlers from "../../src/server/handlers.js";
import fs from "fs";
import path from "path";
import os from "os";

test("Wiki tools should prevent path traversal", async () => {
  const maliciousPath = path.join(os.tmpdir(), "lemma-malicious-vault-" + Math.random().toString(36).substring(7));

  const args = {
    vault_path: maliciousPath,
    project_name: "attack"
  };

  const result = await handlers.handleWikiSetup(args as any);

  const created = fs.existsSync(maliciousPath);
  if (created) {
    fs.rmSync(maliciousPath, { recursive: true, force: true });
  }

  // It should now return an error and NOT create the directory
  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes("Invalid vault path") || result.content[0].text.includes("Vaults must be located within the home directory"));
  assert.strictEqual(created, false, "Vault should not have been created in /tmp");
});

test("Wiki setup should prevent invalid project_name", async () => {
    const vaultPath = path.join(os.homedir(), "valid-vault-" + Math.random().toString(36).substring(7));

    const args = {
        vault_path: vaultPath,
        project_name: "../escaped"
    };

    const result = await handlers.handleWikiSetup(args as any);

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("invalid characters"));

    if (fs.existsSync(vaultPath)) {
        fs.rmSync(vaultPath, { recursive: true, force: true });
    }
});
