import { test } from "node:test";
import assert from "node:assert";
import * as handlers from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("Wiki Security: prevents path traversal in wiki_setup", async () => {
  const evilPath = path.join(os.tmpdir(), "evil-vault-" + Date.now());

  const result = await handlers.handleWikiSetup({
    vault_path: evilPath,
    project_name: "EvilProject"
  });

  if (fs.existsSync(evilPath)) {
    fs.rmSync(evilPath, { recursive: true, force: true });
  }

  assert.strictEqual(result.isError, true, "Should return an error for path outside home directory");
  assert.match(result.content[0].text, /Vault path must be within the home directory/);
});

test("Wiki Security: prevents path traversal with .. in vault_path", async () => {
  const homeDir = os.homedir();
  const traversalPath = path.join(homeDir, "..", "traversal-test-" + Date.now());

  const result = await handlers.handleWikiSetup({
    vault_path: traversalPath,
    project_name: "TraversalProject"
  });

  if (fs.existsSync(traversalPath)) {
    fs.rmSync(traversalPath, { recursive: true, force: true });
  }

  assert.strictEqual(result.isError, true, "Should return an error for path traversal attempting to leave home directory");
  assert.match(result.content[0].text, /Vault path must be within the home directory/);
});
