import { test } from "node:test";
import assert from "node:assert";
import { handleWikiIngest, handleWikiSetup } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("YAML injection prevention in wiki_setup project_name", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_yaml_injection_setup_fixed");
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }

  // Inject a 'tags' field into the YAML frontmatter via project_name
  const projectName = "My Project\ntags: [injected]";
  await handleWikiSetup({ vault_path: vaultPath, project_name: projectName });

  const indexPath = path.join(vaultPath, "index.md");
  const content = fs.readFileSync(indexPath, "utf-8");

  // Injection should be escaped in the YAML section
  // Note: /^---[\s\S]*?^---/m finds the YAML frontmatter
  const yamlMatch = content.match(/^---([\s\S]*?)^---/m);
  const yaml = yamlMatch ? yamlMatch[1] : "";

  assert.match(yaml, /title: "My Project\\ntags: \[injected\] — İçerik Kataloğu"/);
  assert.doesNotMatch(yaml, /^tags: \[injected\]/m);

  fs.rmSync(vaultPath, { recursive: true, force: true });
});

test("YAML injection prevention in wiki_ingest title", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_yaml_injection_ingest_fixed");
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }
  await handleWikiSetup({ vault_path: vaultPath, project_name: "Test Wiki" });

  const title = "My Title\nstatus: compromised";
  await handleWikiIngest({
    vault_path: vaultPath,
    title: title,
    summary: "Test summary"
  });

  // Find the created source file
  const sourcesDir = path.join(vaultPath, "sources");
  const files = fs.readdirSync(sourcesDir);
  const sourceFile = path.join(sourcesDir, files.find(f => f.endsWith(".md"))!);
  const content = fs.readFileSync(sourceFile, "utf-8");

  // Injection should be escaped in the YAML section
  const yamlMatch = content.match(/^---([\s\S]*?)^---/m);
  const yaml = yamlMatch ? yamlMatch[1] : "";

  assert.match(yaml, /title: "My Title\\nstatus: compromised"/);
  assert.doesNotMatch(yaml, /^status: compromised/m);

  fs.rmSync(vaultPath, { recursive: true, force: true });
});
