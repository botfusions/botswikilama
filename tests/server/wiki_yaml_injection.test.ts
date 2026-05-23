import { test } from "node:test";
import assert from "node:assert";
import { handleWikiIngest, handleWikiSetup } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_ingest should sanitize values to prevent YAML injection", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_yaml_injection");

  // Clean up and setup
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }
  await handleWikiSetup({ vault_path: vaultPath, project_name: "Test Wiki" });

  const maliciousTitle = 'My Title\nstatus: high-priority\nadmin: true';

  const result = await handleWikiIngest({
    vault_path: vaultPath,
    title: maliciousTitle,
    summary: "Test summary",
    entities: ["Entity1"]
  });

  assert.strictEqual(result.isError, false || undefined);

  // Find the created source file
  const sourcesDir = path.join(vaultPath, "sources");
  const files = fs.readdirSync(sourcesDir);
  const sourceFile = files.find(f => f.endsWith(".md"));

  assert.ok(sourceFile, "Source file should be created");

  const content = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");

  // If not sanitized, 'status: high-priority' might appear as a top-level YAML key
  // A simple way to check is to see if the malicious string was properly quoted/escaped
  assert.ok(content.includes('"My Title\\nstatus: high-priority\\nadmin: true"') || !content.includes('\nstatus: high-priority\n'),
    "Malicious YAML should be sanitized/quoted");

  // Clean up
  fs.rmSync(vaultPath, { recursive: true, force: true });
});
