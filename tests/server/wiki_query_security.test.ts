import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiQuery } from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_query should NOT follow symbolic links to files outside vault", async () => {
  const homeDir = os.homedir();
  const tmpDir = fs.mkdtempSync(path.join(homeDir, "lemma-wiki-query-test-"));
  const vaultPath = path.join(tmpDir, "vault");
  const secretFile = path.join(tmpDir, "secret.txt");

  try {
    // 1. Setup a secret file outside the vault
    fs.writeFileSync(secretFile, "TOP SECRET CONTENT");

    // 2. Setup the vault
    await handleWikiSetup({ vault_path: vaultPath });

    // 3. Create a symbolic link inside sources/ pointing to the secret file
    const sourcesDir = path.join(vaultPath, "sources");
    const symlinkPath = path.join(sourcesDir, "secret.md");

    fs.symlinkSync(secretFile, symlinkPath);

    // 4. Run query
    const result = await handleWikiQuery({
      vault_path: vaultPath,
      query: "SECRET"
    });

    // 5. Verify that secret content was NOT found
    const foundMatch = result.content[0].text.includes("TOP SECRET CONTENT");
    assert.strictEqual(foundMatch, false, "wiki_query should not follow symlinks to find secret content");

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
