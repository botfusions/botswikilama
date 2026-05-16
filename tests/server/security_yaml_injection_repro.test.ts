import { test } from "node:test";
import assert from "node:assert";
import { handleWikiIngest, handleWikiSetup } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_ingest should be protected against YAML injection in title", async () => {
  const vaultPath = path.join(os.homedir(), ".lemma", "test_yaml_injection_security");

  // Cleanup
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }

  await handleWikiSetup({ vault_path: vaultPath, project_name: "Test Project" });

  const maliciousTitle = "Normal Title\nstatus: compromised\nmalicious: property";
  const result = await handleWikiIngest({
    vault_path: vaultPath,
    title: maliciousTitle,
    summary: "Test summary"
  });

  assert.strictEqual(result.isError, undefined);

  // Check the created file
  const date = new Date().toISOString().split("T")[0];
  const slug = "normal-title-status-compromised-malicious-property";
  const filePath = path.join(vaultPath, "sources", `${date}-${slug}.md`);

  const content = fs.readFileSync(filePath, "utf-8");

  const lines = content.split("\n");
  const fmEndIndex = lines.indexOf("---", 1);
  const frontmatterLines = lines.slice(0, fmEndIndex + 1);

  // Only the template one (status: active) should be present as a key in frontmatter.
  const statusLines = frontmatterLines.filter(l => l.startsWith("status:"));
  assert.strictEqual(statusLines.length, 1, "Should have only one status line in frontmatter");

  const titleLine = frontmatterLines.find(l => l.startsWith("title:"));
  assert.strictEqual(titleLine, 'title: "Normal Title\\nstatus: compromised\\nmalicious: property"', "Title should be sanitized and quoted in frontmatter");

  // Cleanup
  fs.rmSync(vaultPath, { recursive: true, force: true });
});
