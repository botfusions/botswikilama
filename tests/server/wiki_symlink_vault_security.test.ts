import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest, handleWikiQuery, handleWikiLint } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki tools should block symbolic link vault_path pointing outside home directory", async () => {
  const homeDir = os.homedir();
  const tmpHolder = fs.mkdtempSync(path.join(homeDir, "lemma-symlink-holder-"));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-outside-target-"));
  const symlinkPath = path.join(tmpHolder, "outside-link");

  try {
    // Create a symlink in a subdirectory under home pointing outside home
    try {
      fs.symlinkSync(outsideDir, symlinkPath);
    } catch (e) {
      console.error("Symlink creation failed, skipping test:", (e as any).message);
      return;
    }

    // 1. handleWikiSetup should fail
    const setupResult = await handleWikiSetup({ vault_path: symlinkPath });
    assert.strictEqual(setupResult.isError, true);
    assert.match(setupResult.content[0].text, /Access denied/);

    // 2. handleWikiIngest should fail
    const ingestResult = await handleWikiIngest({ vault_path: symlinkPath, summary: "test" });
    assert.strictEqual(ingestResult.isError, true);
    assert.match(ingestResult.content[0].text, /Access denied/);

    // 3. handleWikiQuery should fail
    const queryResult = await handleWikiQuery({ vault_path: symlinkPath, query: "test" });
    assert.strictEqual(queryResult.isError, true);
    assert.match(queryResult.content[0].text, /Access denied/);

    // 4. handleWikiLint should fail
    const lintResult = await handleWikiLint({ vault_path: symlinkPath });
    assert.strictEqual(lintResult.isError, true);
    assert.match(lintResult.content[0].text, /Access denied/);

  } finally {
    try {
      fs.rmSync(tmpHolder, { recursive: true, force: true });
    } catch {}
    try {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    } catch {}
  }
});
