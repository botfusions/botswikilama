import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { handleWikiSetup, handleWikiIngest } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

describe("Wiki YAML Injection Security", () => {
  let tempVaultPath: string;

  beforeEach(() => {
    tempVaultPath = path.join(os.homedir(), ".lemma", `test-vault-${Date.now()}`);
  });

  afterEach(() => {
    if (fs.existsSync(tempVaultPath)) {
      fs.rmSync(tempVaultPath, { recursive: true, force: true });
    }
  });

  test("wiki_setup should NOT be vulnerable to YAML injection in project_name", async () => {
    const maliciousProjectName = "Project\ninjected: true";
    await handleWikiSetup({
      vault_path: tempVaultPath,
      project_name: maliciousProjectName
    });

    const indexPath = path.join(tempVaultPath, "index.md");
    const content = fs.readFileSync(indexPath, "utf-8");

    // If protected, it should be escaped as \n and wrapped in quotes
    assert.ok(content.includes('"Project\\ninjected: true — İçerik Kataloğu"'), "Project name not correctly sanitized in index.md");
  });

  test("wiki_ingest should NOT be vulnerable to YAML injection in title", async () => {
    await handleWikiSetup({ vault_path: tempVaultPath, project_name: "Test" });

    const maliciousTitle = "Title\ninjected: true";
    const result = await handleWikiIngest({
      vault_path: tempVaultPath,
      title: maliciousTitle,
      summary: "Test summary"
    });

    assert.strictEqual(result.isError, undefined);

    // Find the created file
    const sourcesDir = path.join(tempVaultPath, "sources");
    const files = fs.readdirSync(sourcesDir);
    const createdFile = files.find(f => f.includes("title"));
    assert.ok(createdFile, "Source file not created");

    const content = fs.readFileSync(path.join(sourcesDir, createdFile), "utf-8");
    assert.ok(content.includes('"Title\\ninjected: true"'), "Title not correctly sanitized in source file");
  });

  test("wiki_ingest should NOT be vulnerable to YAML injection in entities", async () => {
    await handleWikiSetup({ vault_path: tempVaultPath, project_name: "Test" });

    const maliciousEntity = "Entity\ninjected: true";
    await handleWikiIngest({
      vault_path: tempVaultPath,
      summary: "Test summary",
      entities: [maliciousEntity]
    });

    const entityDir = path.join(tempVaultPath, "entities");
    const files = fs.readdirSync(entityDir);
    const createdFile = files.find(f => f.includes("entity"));
    assert.ok(createdFile, "Entity file not created");

    const content = fs.readFileSync(path.join(entityDir, createdFile), "utf-8");
    assert.ok(content.includes('"Entity\\ninjected: true"'), "Entity not correctly sanitized in entity file");
  });
});
