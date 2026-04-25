import { test, describe } from "node:test";
import assert from "node:assert";
import * as handlers from "../../src/server/handlers.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Wiki Security - Path Traversal", () => {
  test("wiki_setup should reject path traversal with ..", async () => {
    const maliciousPath = path.join(os.homedir(), "..", "malicious-vault");

    const result = await handlers.handleWikiSetup({
      vault_path: maliciousPath,
      project_name: "test"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path"));
  });

  test("wiki_ingest should reject path traversal", async () => {
    const maliciousPath = path.join(os.homedir(), "..", "malicious-vault");

    const result = await handlers.handleWikiIngest({
      vault_path: maliciousPath,
      summary: "test summary"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path"));
  });

  test("wiki_query should reject path traversal", async () => {
    const maliciousPath = path.join(os.homedir(), "..", "malicious-vault");

    const result = await handlers.handleWikiQuery({
      vault_path: maliciousPath,
      query: "test"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path"));
  });

  test("wiki_lint should reject path traversal", async () => {
    const maliciousPath = path.join(os.homedir(), "..", "malicious-vault");

    const result = await handlers.handleWikiLint({
      vault_path: maliciousPath
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path"));
  });

  test("should allow safe paths within homedir", async () => {
    const safePath = path.join(os.homedir(), ".lemma-test-vault");
    // Clean up if exists
    if (fs.existsSync(safePath)) {
        fs.rmSync(safePath, { recursive: true, force: true });
    }

    const result = await handlers.handleWikiSetup({
      vault_path: safePath,
      project_name: "test"
    });

    assert.notStrictEqual(result.isError, true);
    assert.ok(fs.existsSync(path.join(safePath, "index.md")));

    // Clean up
    fs.rmSync(safePath, { recursive: true, force: true });
  });
});
