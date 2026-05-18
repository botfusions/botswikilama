import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import { handleWikiSetup, handleWikiIngest } from "../src/server/handlers.js";

describe("Wiki YAML Injection Security", () => {
  const testVaultPath = path.join(os.homedir(), ".lemma", "test-vault-security-" + Date.now());

  before(() => {
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
    }
  });

  after(() => {
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
    }
  });

  it("should sanitize malicious title to prevent YAML injection in wiki_ingest", async () => {
    // Setup vault
    await handleWikiSetup({
      vault_path: testVaultPath,
      project_name: "SecurityTest"
    });

    // Malicious title that tries to inject a new YAML key
    const maliciousTitle = 'My Title\nowner: admin\nsecret: "top-secret"';

    await handleWikiIngest({
      vault_path: testVaultPath,
      title: maliciousTitle,
      summary: "This is a test summary",
      entities: ["Security"]
    });

    // Check the created source page
    const sourcesDir = path.join(testVaultPath, "sources");
    const files = fs.readdirSync(sourcesDir);
    const sourceFile = files.find(f => f.endsWith(".md"));
    assert.ok(sourceFile, "Source file should be created");

    const content = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");

    // The title should be quoted and escaped, NOT literal
    assert.ok(content.includes('title: "My Title\\nowner: admin\\nsecret: \\"top-secret\\""'), "Title should be sanitized in YAML frontmatter");

    // Ensure the injected keys are not present as top-level YAML keys (before the first --- or after the second ---)
    const fmEndIndex = content.indexOf("---", 4);
    const frontmatter = content.substring(0, fmEndIndex + 3);
    const lines = frontmatter.split("\n");
    const ownerLine = lines.find(l => l.startsWith("owner:"));
    const secretLine = lines.find(l => l.startsWith("secret:"));

    assert.strictEqual(ownerLine, undefined, "Injected 'owner' key should not exist as a top-level YAML key");
    assert.strictEqual(secretLine, undefined, "Injected 'secret' key should not exist as a top-level YAML key");
  });

  it("should sanitize malicious project name in wiki_setup", async () => {
    const maliciousVaultPath = path.join(os.homedir(), ".lemma", "test-vault-setup-security-" + Date.now());
    const maliciousProjectName = 'Project\nowner: admin';

    await handleWikiSetup({
      vault_path: maliciousVaultPath,
      project_name: maliciousProjectName
    });

    const indexPath = path.join(maliciousVaultPath, "index.md");
    const content = fs.readFileSync(indexPath, "utf-8");

    // The title should be sanitized
    assert.ok(content.includes('title: "Project\\nowner: admin — İçerik Kataloğu"'), "Project name should be sanitized in index.md YAML frontmatter");

    const fmEndIndex = content.indexOf("---", 4);
    const frontmatter = content.substring(0, fmEndIndex + 3);
    const lines = frontmatter.split("\n");
    const ownerLine = lines.find(l => l.startsWith("owner:"));
    assert.strictEqual(ownerLine, undefined, "Injected 'owner' key should not exist in index.md frontmatter");

    fs.rmSync(maliciousVaultPath, { recursive: true, force: true });
  });
});
