import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import { handleWikiSetup, handleWikiIngest, handleWikiLint } from "../../src/server/handlers.js";

describe("Wiki Path Exposure in Files", () => {
  const homeDir = os.homedir();
  const testVaultPath = path.join(homeDir, ".lemma", "test-vault-exposure");

  beforeEach(() => {
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
    }
  });

  test("should NOT expose home directory in log.md", async () => {
    await handleWikiSetup({
      vault_path: testVaultPath,
      project_name: "Test Exposure"
    });

    const externalFile = path.join(homeDir, "external-source.txt");
    fs.writeFileSync(externalFile, "some content");

    await handleWikiIngest({
      vault_path: testVaultPath,
      file_path: externalFile,
      title: "Test Ingest",
      summary: "Test Summary"
    });

    const logContent = fs.readFileSync(path.join(testVaultPath, "log.md"), "utf-8");
    assert.ok(!logContent.includes(homeDir), `Log should not contain absolute home path. Found: ${logContent}`);
    assert.ok(logContent.includes("~"), `Log should contain redacted tilde path. Found: ${logContent}`);

    fs.unlinkSync(externalFile);
  });

  test("should NOT expose home directory in lint-report.md", async () => {
    await handleWikiSetup({
      vault_path: testVaultPath,
      project_name: "Test Exposure"
    });

    await handleWikiLint({
      vault_path: testVaultPath
    });

    const reportContent = fs.readFileSync(path.join(testVaultPath, "lint-report.md"), "utf-8");
    assert.ok(!reportContent.includes(homeDir), `Lint report should not contain absolute home path. Found: ${reportContent}`);
    assert.ok(reportContent.includes("~"), `Lint report should contain redacted tilde path. Found: ${reportContent}`);
  });

  test("should NOT expose home directory in source page frontmatter", async () => {
    await handleWikiSetup({
      vault_path: testVaultPath,
      project_name: "Test Exposure"
    });

    const externalFile = path.join(homeDir, "external-source-2.txt");
    fs.writeFileSync(externalFile, "some content");

    await handleWikiIngest({
      vault_path: testVaultPath,
      file_path: externalFile,
      title: "Test Ingest 2",
      summary: "Test Summary 2"
    });

    // Find the source file (it has a date prefix)
    const sourcesDir = path.join(testVaultPath, "sources");
    const files = fs.readdirSync(sourcesDir);
    const sourceFile = files.find(f => f.endsWith("-test-ingest-2.md"));

    assert.ok(sourceFile, "Source file should be created");
    const content = fs.readFileSync(path.join(sourcesDir, sourceFile), "utf-8");

    assert.ok(!content.includes(homeDir), `Source page frontmatter should not contain absolute home path. Found: ${content}`);
    assert.ok(content.includes("~"), `Source page frontmatter should contain redacted tilde path. Found: ${content}`);

    fs.unlinkSync(externalFile);
  });
});
