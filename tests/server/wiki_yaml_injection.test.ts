import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { handleWikiSetup, handleWikiIngest } from "../../src/server/handlers.js";

describe("Wiki YAML Injection Protection", () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test-wiki-injection");

  beforeEach(() => {
    if (fs.existsSync(vaultPath)) {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(vaultPath)) {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  test("wiki_setup should escape project_name in YAML frontmatter", async () => {
    const maliciousName = "Normal Project\ninjected_key: injected_value";
    await handleWikiSetup({
      vault_path: vaultPath,
      project_name: maliciousName
    });

    const indexPath = path.join(vaultPath, "index.md");
    const content = fs.readFileSync(indexPath, "utf-8");

    // Check that frontmatter is protected
    const frontmatter = content.split("---")[1];
    assert.ok(!frontmatter.includes("\ninjected_key: injected_value"), "Unescaped YAML injection should NOT be present in frontmatter");
    assert.ok(frontmatter.includes('title: "Normal Project\\ninjected_key: injected_value'), "Project name should be escaped in frontmatter");
  });

  test("wiki_ingest should escape title in YAML frontmatter", async () => {
    await handleWikiSetup({ vault_path: vaultPath, project_name: "Test" });

    const maliciousTitle = "Malicious Title\ninjected_key: injected_value";
    await handleWikiIngest({
      vault_path: vaultPath,
      title: maliciousTitle,
      summary: "Test summary"
    });

    const sourcesDir = path.join(vaultPath, "sources");
    const files = fs.readdirSync(sourcesDir);
    const sourceFile = files.find(f => f.endsWith(".md"));
    assert.ok(sourceFile);

    const content = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");
    const frontmatter = content.split("---")[1];
    assert.ok(!frontmatter.includes("\ninjected_key: injected_value"), "Unescaped YAML injection should NOT be present in frontmatter");
    assert.ok(frontmatter.includes('title: "Malicious Title\\ninjected_key: injected_value"'), "Title should be escaped in frontmatter");
  });

  test("wiki_ingest should escape entities in YAML frontmatter", async () => {
    await handleWikiSetup({ vault_path: vaultPath, project_name: "Test" });

    const maliciousEntity = "Malicious Entity\ninjected_key: injected_value";
    await handleWikiIngest({
      vault_path: vaultPath,
      title: "Test",
      summary: "Test summary",
      entities: [maliciousEntity]
    });

    const entitiesDir = path.join(vaultPath, "entities");
    const files = fs.readdirSync(entitiesDir);
    const entityFile = files.find(f => f.includes("malicious-entity"));
    assert.ok(entityFile);

    const content = fs.readFileSync(path.join(entitiesDir, entityFile), "utf-8");
    const frontmatter = content.split("---")[1];
    assert.ok(!frontmatter.includes("\ninjected_key: injected_value"), "Unescaped YAML injection should NOT be present in frontmatter");
    assert.ok(frontmatter.includes('title: "Malicious Entity\\ninjected_key: injected_value"'), "Entity title should be escaped in frontmatter");
  });
});
