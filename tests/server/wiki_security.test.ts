import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import * as handlers from "../../src/server/handlers.js";

describe("Wiki Path Traversal Security", () => {
  const homeDir = os.homedir();

  test("wiki_setup should NOT allow paths outside of home directory", async () => {
    const maliciousPath = path.join(os.tmpdir(), "evil-vault-" + Math.random().toString(36).substring(7));
    const result = await handlers.handleWikiSetup({
      vault_path: maliciousPath,
      project_name: "Evil"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Security Error") || result.content[0].text.includes("Vault path must be a subdirectory"));
    assert.strictEqual(fs.existsSync(path.join(maliciousPath, "index.md")), false);
  });

  test("wiki_setup should NOT allow path traversal with literal ..", async () => {
    // We must pass the string with .. to the handler
    const maliciousPath = homeDir + "/lemma-vault/../evil-outside";
    const result = await handlers.handleWikiSetup({
      vault_path: maliciousPath,
      project_name: "Evil"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Security Error") || result.content[0].text.includes(".."));
  });

  test("wiki_ingest should NOT allow file_path outside of vault", async () => {
    const vaultPath = path.join(homeDir, "safe-vault-" + Math.random().toString(36).substring(7));

    // Setup a valid vault first
    await handlers.handleWikiSetup({
      vault_path: vaultPath,
      project_name: "Safe"
    });

    // Try to ingest a file from outside the vault
    const maliciousFile = path.join(os.tmpdir(), "secret.txt");
    fs.writeFileSync(maliciousFile, "secret");

    const result = await handlers.handleWikiIngest({
      vault_path: vaultPath,
      file_path: maliciousFile,
      summary: "Attempting to read outside"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("must be within the vault path"));

    // Cleanup
    if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true, force: true });
    if (fs.existsSync(maliciousFile)) fs.rmSync(maliciousFile, { force: true });
  });

  test("wiki_setup should NOT allow paths that are home directory exactly", async () => {
    const result = await handlers.handleWikiSetup({
      vault_path: homeDir,
      project_name: "Home"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("must be a subdirectory"));
  });
});
