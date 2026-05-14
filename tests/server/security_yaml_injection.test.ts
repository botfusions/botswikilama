import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki tools should sanitize YAML values to prevent injection", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_wiki_injection_" + Date.now());

  try {
    // 1. Test injection via project_name in wiki_setup
    const maliciousProjectName = "My Wiki\nkey: value";
    await handleWikiSetup({
      vault_path: vaultPath,
      project_name: maliciousProjectName
    });

    const indexContent = fs.readFileSync(path.join(vaultPath, "index.md"), "utf-8");
    // Correctly sanitized output should NOT contain the raw injection
    assert.ok(!indexContent.includes("title: My Wiki\nkey: value"), "Should NOT contain raw injected YAML key in index.md");
    // Check for fully quoted value
    assert.ok(indexContent.includes("title: \"My Wiki\\nkey: value — İçerik Kataloğu\""), "Should contain fully quoted title in index.md");

    // 2. Test injection via title in wiki_ingest
    const maliciousTitle = "Malicious Title\nstatus: pwned";
    const ingestResult = await handleWikiIngest({
      vault_path: vaultPath,
      title: maliciousTitle,
      summary: "test summary"
    });

    assert.strictEqual(ingestResult.isError, undefined, "Ingest should be successful");

    // Find the created source file
    const sourcesDir = path.join(vaultPath, "sources");
    const files = fs.readdirSync(sourcesDir);
    const sourceFile = files.find(f => f.includes("malicious-title"));
    assert.ok(sourceFile, "Source file should be created");

    const pageContent = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");
    assert.ok(!pageContent.includes("title: Malicious Title\nstatus: pwned"), "Should NOT contain raw injected YAML key in page content");
    assert.ok(pageContent.includes("title: \"Malicious Title\\nstatus: pwned\""), "Should contain sanitized/quoted title in page content");

  } finally {
    if (fs.existsSync(vaultPath)) {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  }
});
