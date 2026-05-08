import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_ingest should skip symbolic links to files outside vault", async () => {
  const homeDir = os.homedir();
  const tmpDir = fs.mkdtempSync(path.join(homeDir, "lemma-wiki-test-"));
  const vaultPath = path.join(tmpDir, "vault");
  const secretFile = path.join(tmpDir, "secret.txt");

  try {
    // 1. Setup a secret file outside the vault
    fs.writeFileSync(secretFile, "secret content");

    // 2. Setup the vault
    await handleWikiSetup({ vault_path: vaultPath });

    // 3. Create a symbolic link inside raw/articles pointing to the secret file
    const rawArticlesDir = path.join(vaultPath, "raw", "articles");
    // Ensure the directory exists (should be created by wiki_setup, but let's be sure)
    fs.mkdirSync(rawArticlesDir, { recursive: true });

    const symlinkPath = path.join(rawArticlesDir, "sneaky_link.md");

    try {
      fs.symlinkSync(secretFile, symlinkPath);
    } catch (e) {
      console.error("Symlink creation failed, skipping test part:", e.message);
      throw e;
    }

    // 4. Run ingest
    const result = await handleWikiIngest({
      vault_path: vaultPath,
      summary: "test ingest"
    });

    // 5. Verify that sneaky_link.md was NOT ingested
    // We check the result message and the vault filesystem
    if (result.isError) {
        console.log("Ingest Error:", result.content[0].text);
    }
    assert.strictEqual(result.isError, undefined);
    assert.match(result.content[0].text, /Pages created: 1/); // Only the summary page, no entities/concepts from the symlinked file

    const sourcesDir = path.join(vaultPath, "sources");
    const sourcesFiles = fs.readdirSync(sourcesDir);
    // There should be exactly 0 or 1 file (the summary page) and NO content from secret.txt

    // Check if any source page contains "secret content"
    for (const file of sourcesFiles) {
        if (file.endsWith(".md")) {
            const content = fs.readFileSync(path.join(sourcesDir, file), "utf8");
            assert.ok(!content.includes("secret content"), `Source page ${file} should not contain secret content`);
        }
    }

  } finally {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
        // ignore cleanup errors
    }
  }
});
