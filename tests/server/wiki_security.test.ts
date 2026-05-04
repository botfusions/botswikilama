import { test } from "node:test";
import assert from "node:assert";
import * as handlers from "../../src/server/handlers.js";
import path from "path";
import os from "os";

test("wiki_setup should block path traversal with '..'", async () => {
  const maliciousPath = path.join(os.homedir(), "vault/../../etc");

  const args = {
    vault_path: maliciousPath,
    project_name: "Test Project"
  };

  const result = await handlers.handleWikiSetup(args);
  assert.strictEqual(result.isError, true);
  // It might fail with "Access denied" instead of "Path traversal attempt detected"
  // if path.join/resolve resolves it outside home before the ".." check?
  // No, the ".." check is first.
  assert.ok(result.content[0].text.includes("Path traversal attempt detected") ||
            result.content[0].text.includes("Access denied"));
});

test("wiki_setup should block malicious project_name", async () => {
  const validPath = path.join(os.homedir(), "lemma-wiki-project-test");

  const args = {
    vault_path: validPath,
    project_name: "../../../etc/passwd"
  };

  const result = await handlers.handleWikiSetup(args);
  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes("invalid characters"));
});

test("wiki_setup should block paths outside home directory", async () => {
  // Use a path that is likely outside the home directory on most systems
  const outsidePath = "/tmp/malicious-vault";

  const args = {
    vault_path: outsidePath,
    project_name: "Test Project"
  };

  const result = await handlers.handleWikiSetup(args);
  assert.strictEqual(result.isError, true);
  assert.ok(result.content[0].text.includes("Access denied: Vault must be located within the user's home directory"));
});

test("wiki_setup should allow valid paths within home directory", async () => {
  const validPath = path.join(os.homedir(), "lemma-wiki-test-" + Date.now());

  const args = {
    vault_path: validPath,
    project_name: "Test Project"
  };

  const result = await handlers.handleWikiSetup(args);
  assert.strictEqual(result.isError, undefined);
  assert.ok(result.content[0].text.includes("Wiki vault created") || result.content[0].text.includes("Wiki vault already exists"));
});

test("wiki_setup should allow tilde expansion", async () => {
  const tildePath = "~/lemma-wiki-tilde-test-" + Date.now();

  const args = {
    vault_path: tildePath,
    project_name: "Test Project"
  };

  const result = await handlers.handleWikiSetup(args);
  assert.strictEqual(result.isError, undefined);
  assert.ok(result.content[0].text.includes("Wiki vault created") || result.content[0].text.includes("Wiki vault already exists"));
});
