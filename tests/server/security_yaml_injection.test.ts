import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_ingest should sanitize YAML values to prevent injection", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_yaml_sanitization");

  // Setup vault
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }
  await handleWikiSetup({ vault_path: vaultPath, project_name: "Test Wiki" });

  // Ingest with malicious title
  const maliciousTitle = "Normal Title\nkey: injected-value";
  await handleWikiIngest({
    vault_path: vaultPath,
    title: maliciousTitle,
    summary: "Test summary"
  });

  // Find the created file
  const sourcesDir = path.join(vaultPath, "sources");
  const files = fs.readdirSync(sourcesDir);
  const sourceFile = files.find(f => f.endsWith(".md"));

  assert.ok(sourceFile, "Source file should have been created");

  const content = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");

  // Check if injection was prevented in frontmatter
  const parts = content.split("---");
  const frontmatter = parts[1];

  // It should NOT contain "key: injected-value" as a separate key (which requires a newline)
  // In our case, we escaped \n to \\n, so it's no longer a newline.
  assert.strictEqual(frontmatter.includes("\nkey: injected-value\n"), false, "YAML injection should NOT be present in frontmatter");

  // It SHOULD contain the sanitized value wrapped in quotes and escaped
  assert.ok(frontmatter.includes('title: "Normal Title\\nkey: injected-value"'), "Title should be sanitized and wrapped in quotes in frontmatter");

  // Cleanup
  fs.rmSync(vaultPath, { recursive: true, force: true });
});
