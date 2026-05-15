import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import * as handlers from "../../src/server/handlers.js";
import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";

describe("Wiki YAML Injection Security", () => {
  let TMPDIR: string;
  let vaultPath: string;

  beforeEach(() => {
    // Must be in homedir to pass validateVaultPath
    const baseDir = path.join(os.homedir(), ".lemma-test");
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
    TMPDIR = fs.mkdtempSync(path.join(baseDir, "injection-"));
    vaultPath = path.join(TMPDIR, "test-vault");

    core.setMemoryDir(TMPDIR);
    guides.setGuidesDir(TMPDIR);
  });

  afterEach(() => {
    fs.rmSync(TMPDIR, { recursive: true, force: true });
  });

  test("wiki_ingest should sanitize YAML injection in title", async () => {
    // 1. Setup vault
    await handlers.handleWikiSetup({
      vault_path: vaultPath,
      project_name: "Test Project"
    });

    // 2. Ingest with malicious title
    const maliciousTitle = "Normal Title\nstatus: compromised\ninjected: true";
    const result = await handlers.handleWikiIngest({
      vault_path: vaultPath,
      title: maliciousTitle,
      summary: "Test summary",
    });
    if (result.isError) {
      throw new Error(`wiki_ingest failed: ${result.content[0].text}`);
    }

    // 3. Check the created file
    const sourcesDir = path.join(vaultPath, "sources");
    const files = fs.readdirSync(sourcesDir);
    const mdFiles = files.filter(f => f.endsWith(".md"));
    assert.ok(mdFiles.length > 0, "No source file created");
    const sourceFile = path.join(sourcesDir, mdFiles[0]);
    const content = fs.readFileSync(sourceFile, "utf-8");

    // The injected content in frontmatter should be quoted and escaped
    assert.ok(content.includes('title: "Normal Title\\nstatus: compromised\\ninjected: true"'), "YAML title was not properly sanitized in frontmatter");

    // Split content to separate frontmatter and body
    const parts = content.split("---");
    const frontmatter = parts[1];

    assert.ok(!frontmatter.includes("\nstatus: compromised\n"), "YAML injection succeeded in frontmatter (not sanitized)");
  });

  test("wiki_setup should sanitize YAML injection in project_name", async () => {
    const maliciousProject = "Test Project\ninjected: true";
    await handlers.handleWikiSetup({
      vault_path: vaultPath,
      project_name: maliciousProject
    });

    const indexPath = path.join(vaultPath, "index.md");
    const content = fs.readFileSync(indexPath, "utf-8");

    assert.ok(content.includes('title: "Test Project\\ninjected: true — İçerik Kataloğu"'), "YAML project_name was not properly sanitized");

    const parts = content.split("---");
    const frontmatter = parts[1];
    assert.ok(!frontmatter.includes("\ninjected: true\n"), "YAML injection in project_name succeeded in frontmatter (not sanitized)");
  });
});
