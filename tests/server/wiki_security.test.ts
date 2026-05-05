import assert from "node:assert";
import test, { describe } from "node:test";
import * as handlers from "../../src/server/handlers.js";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

describe("Wiki Security - Path Traversal", () => {
  test("wiki_setup should block path traversal with ..", async () => {
    const maliciousPath = os.homedir() + path.sep + ".." + path.sep + "dangerous_dir";

    const result = await handlers.handleWikiSetup({
      vault_path: maliciousPath,
      project_name: "test"
    });

    assert.ok(result.isError, "Should return an error for traversal path");
    assert.match(result.content[0].text, /Security Error: Vault path must be within the home directory/i);
  });

  test("wiki_setup should block paths outside home directory", async () => {
    const outsidePath = process.platform === "win32" ? "C:\\Windows\\System32" : "/etc/passwd";

    const result = await handlers.handleWikiSetup({
      vault_path: outsidePath,
      project_name: "test"
    });

    assert.ok(result.isError, "Should return an error for path outside home");
    assert.match(result.content[0].text, /Security Error: Vault path must be within the home directory/i);
  });

  test("wiki_setup should block malicious project_name", async () => {
    const result = await handlers.handleWikiSetup({
      vault_path: path.join(os.homedir(), ".lemma", "wiki"),
      project_name: "../escaped"
    });

    assert.ok(result.isError, "Should return an error for malicious project_name");
    assert.match(result.content[0].text, /Error: 'project_name' contains invalid characters/i);
  });

  test("wiki_setup should allow valid path in home directory", async () => {
    const validPath = path.join(os.homedir(), ".lemma", "test_vault_" + Date.now());

    const result = await handlers.handleWikiSetup({
      vault_path: validPath,
      project_name: "valid-project"
    });

    assert.strictEqual(result.isError, undefined, "Should not return an error for valid path");
    assert.match(result.content[0].text, /Wiki vault created/i);

    // Cleanup
    if (fs.existsSync(validPath)) {
      fs.rmSync(validPath, { recursive: true, force: true });
    }
  });

  test("wiki_setup should allow tilde expansion", async () => {
    const tildePath = "~/.lemma/tilde_test_" + Date.now();
    const result = await handlers.handleWikiSetup({
      vault_path: tildePath,
      project_name: "tilde-test"
    });

    assert.strictEqual(result.isError, undefined, "Should allow tilde path");

    const resolvedPath = path.join(os.homedir(), ".lemma", path.basename(tildePath));
    assert.ok(fs.existsSync(resolvedPath), "Tilde path should be resolved and created");

    // Cleanup
    if (fs.existsSync(resolvedPath)) {
      fs.rmSync(resolvedPath, { recursive: true, force: true });
    }
  });

  test("wiki_ingest should block traversal", async () => {
    const result = await handlers.handleWikiIngest({
      vault_path: path.join(os.homedir(), "..", "malicious"),
      summary: "test"
    });
    assert.ok(result.isError);
    assert.match(result.content[0].text, /Security Error/i);
  });

  test("wiki_query should block traversal", async () => {
    const result = await handlers.handleWikiQuery({
      vault_path: path.join(os.homedir(), "..", "malicious"),
      query: "test"
    });
    assert.ok(result.isError);
    assert.match(result.content[0].text, /Security Error/i);
  });

  test("wiki_lint should block traversal", async () => {
    const result = await handlers.handleWikiLint({
      vault_path: path.join(os.homedir(), "..", "malicious")
    });
    assert.ok(result.isError);
    assert.match(result.content[0].text, /Security Error/i);
  });
});
