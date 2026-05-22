import { test } from "node:test";
import assert from "node:assert";
import { handleWikiIngest, handleWikiSetup } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_ingest should be protected against YAML injection in title", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_yaml_injection");

  // Clean up and setup
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }
  await handleWikiSetup({ vault_path: vaultPath, project_name: "Test Wiki" });

  const maliciousTitle = "Normal Title\ninjected: value\n---";
  const result = await handleWikiIngest({
    vault_path: vaultPath,
    title: maliciousTitle,
    summary: "Test summary"
  });

  assert.strictEqual(result.isError, undefined);

  // Check the created source page
  const sourcesDir = path.join(vaultPath, "sources");
  const files = fs.readdirSync(sourcesDir).filter(f => f.endsWith(".md"));
  assert.ok(files.length > 0);

  const content = fs.readFileSync(path.join(sourcesDir, files[0]), "utf-8");

  // If sanitized, the title should be quoted or escaped, not starting a new YAML line
  // The current implementation just does title: ${title}

  const frontmatter = content.split("---")[1];
  assert.ok(frontmatter.includes('title: "Normal Title\\ninjected: value\\n---"') ||
            !frontmatter.includes("\ninjected: value\n"),
            "YAML injection detected in frontmatter!");
});

test("wiki_setup should be protected against YAML injection in project_name", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_yaml_injection_setup");

  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }

  const maliciousProjectName = "Test\ninjected: value";
  await handleWikiSetup({ vault_path: vaultPath, project_name: maliciousProjectName });

  const indexPath = path.join(vaultPath, "index.md");
  const content = fs.readFileSync(indexPath, "utf-8");
  const frontmatter = content.split("---")[1];

  assert.ok(frontmatter.includes('title: "Test\\ninjected: value — İçerik Kataloğu"') ||
            !frontmatter.includes("\ninjected: value"),
            "YAML injection detected in index.md frontmatter!");
});
