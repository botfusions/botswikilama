import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as handlers from "../../src/server/handlers.js";

describe("Wiki Security — Path Traversal Protection", () => {
  let TMPDIR: string;
  let outsideDir: string;

  beforeEach(() => {
    TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-wiki-test-"));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-outside-"));
  });

  afterEach(() => {
    fs.rmSync(TMPDIR, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  test("wiki_setup blocks paths with '..'", async () => {
    const maliciousPath = path.join(TMPDIR, "..", path.basename(outsideDir));
    const result = await handlers.handleWikiSetup({
      vault_path: maliciousPath,
      project_name: "Attacker"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path") || result.content[0].text.includes("traversal"));
  });

  test("wiki_setup blocks paths outside homedir", async () => {
    // Note: In some environments, /tmp might be outside what we consider "safe"
    // but for the sake of this test, we want to ensure it's restricted to homedir if that's our policy.
    // However, since tests run in /tmp, we might need to be careful.
    // Let's try a path that is definitely not in homedir.
    const rootPath = os.platform() === 'win32' ? 'C:\\Windows\\System32\\lemma-wiki' : '/etc/lemma-wiki';

    const result = await handlers.handleWikiSetup({
      vault_path: rootPath,
      project_name: "Attacker"
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path") || result.content[0].text.includes("home directory"));
  });

  test("wiki_ingest blocks malicious vault_path", async () => {
    const maliciousPath = path.join(TMPDIR, "..", "nonexistent-secret-vault");
    const result = await handlers.handleWikiIngest({
      vault_path: maliciousPath,
      summary: "test"
    });

    assert.strictEqual(result.isError, true);
  });

  test("wiki_query blocks malicious vault_path", async () => {
    const maliciousPath = path.join(TMPDIR, "..", "nonexistent-secret-vault");
    const result = await handlers.handleWikiQuery({
      vault_path: maliciousPath,
      query: "test"
    });

    assert.strictEqual(result.isError, true);
  });

  test("wiki_lint blocks malicious vault_path", async () => {
    const maliciousPath = path.join(TMPDIR, "..", "nonexistent-secret-vault");
    const result = await handlers.handleWikiLint({
      vault_path: maliciousPath
    });

    assert.strictEqual(result.isError, true);
  });
});
