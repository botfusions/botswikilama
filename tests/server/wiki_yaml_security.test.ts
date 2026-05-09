import { test } from "node:test";
import assert from "node:assert";
import * as handlers from "../../src/server/handlers.js";
import * as wiki from "../../src/wiki/index.js";
import fs from "fs";
import path from "path";
import os from "os";

test("Wiki Ingest YAML Injection", async () => {
  const vaultPath = path.join(os.homedir(), "test-vault-yaml-injection");

  // Cleanup
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }

  // Setup
  await handlers.handleWikiSetup({ vault_path: vaultPath, project_name: "Test" });

  // Ingest with malicious title
  const maliciousTitle = "Injection Test\nkey: value";
  await handlers.handleWikiIngest({
    vault_path: vaultPath,
    title: maliciousTitle,
    summary: "Testing YAML injection",
  });

  // Find the created source file
  const sourcesDir = path.join(vaultPath, "sources");
  const files = fs.readdirSync(sourcesDir);
  const sourceFile = files.find(f => f.includes("injection-test-key-value"));

  assert.ok(sourceFile, "Source file should be created");

  const content = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");

  // Check if injection succeeded (should be sanitized now in the frontmatter)
  // We check specifically the frontmatter part (first two ---)
  const frontmatter = content.split("---")[1];

  assert.ok(!frontmatter.includes("\nkey: value\n"), "YAML injection should NOT be present in the frontmatter");
  assert.ok(frontmatter.includes('title: "Injection Test key: value"'), "Title should be sanitized and wrapped in quotes in frontmatter");

  // Cleanup
  fs.rmSync(vaultPath, { recursive: true, force: true });
});
