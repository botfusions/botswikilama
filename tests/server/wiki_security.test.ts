import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest, handleWikiQuery, handleWikiLint } from "../../src/server/handlers.js";
import os from "os";
import path from "path";

test("wiki tools should block path traversal to outside home directory", async () => {
  const traversalPath = path.join(os.homedir(), "..", "secret_vault");

  // wiki_setup
  const setupResult = await handleWikiSetup({ vault_path: traversalPath });
  assert.strictEqual(setupResult.isError, true);
  assert.match(setupResult.content[0].text, /Access denied/);

  // wiki_ingest
  const ingestResult = await handleWikiIngest({ vault_path: traversalPath, summary: "test" });
  assert.strictEqual(ingestResult.isError, true);
  assert.match(ingestResult.content[0].text, /Access denied/);

  // wiki_query
  const queryResult = await handleWikiQuery({ vault_path: traversalPath, query: "test" });
  assert.strictEqual(queryResult.isError, true);
  assert.match(queryResult.content[0].text, /Access denied/);

  // wiki_lint
  const lintResult = await handleWikiLint({ vault_path: traversalPath });
  assert.strictEqual(lintResult.isError, true);
  assert.match(lintResult.content[0].text, /Access denied/);
});

test("wiki_setup should block traversal in project_name", async () => {
  const safeVaultPath = path.join(os.homedir(), ".lemma", "test_wiki");

  const setupResult = await handleWikiSetup({
    vault_path: safeVaultPath,
    project_name: "../sneaky-traversal"
  });

  assert.strictEqual(setupResult.isError, true);
  assert.match(setupResult.content[0].text, /Invalid project_name/);
});
