import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest } from "../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_ingest should be protected against YAML injection in title", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_wiki_injection");

  // Cleanup
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }

  await handleWikiSetup({ vault_path: vaultPath });

  const maliciousTitle = 'Normal Title\nkey: value';
  await handleWikiIngest({
    vault_path: vaultPath,
    title: maliciousTitle,
    summary: "Test summary"
  });

  // Find the created source page
  const sourcesDir = path.join(vaultPath, "sources");
  const files = fs.readdirSync(sourcesDir);
  const sourceFile = files.find(f => f.endsWith(".md"));

  assert.ok(sourceFile, "Source file should be created");
  const content = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");

  // If not sanitized, the frontmatter will look like:
  // ---
  // title: Normal Title
  // key: value
  // ...

  // We want it to be:
  // ---
  // title: "Normal Title\nkey: value"
  // ...

  const frontmatter = content.split("---")[1];
  assert.ok(!frontmatter.includes("\nkey: value"), "Should not contain injected YAML key");
  assert.match(frontmatter, /title: "Normal Title\\nkey: value"/, "Title should be sanitized and quoted");

  // Cleanup
  fs.rmSync(vaultPath, { recursive: true, force: true });
});
