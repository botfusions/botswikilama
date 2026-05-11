import { test } from "node:test";
import assert from "node:assert";
import { handleWikiSetup, handleWikiIngest } from "../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

test("wiki_ingest should prevent YAML injection in frontmatter", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-wiki-yaml-test-"));
    const vaultPath = path.join(tmpDir, "vault");

    try {
        const homeVaultPath = path.join(os.homedir(), ".lemma-test-yaml-vault");
        if (fs.existsSync(homeVaultPath)) fs.rmSync(homeVaultPath, { recursive: true, force: true });

        await handleWikiSetup({ vault_path: homeVaultPath, project_name: "Test" });

        const maliciousTitle = 'Vulnerable Title\nkey: value\n---';
        const result = await handleWikiIngest({
            vault_path: homeVaultPath,
            title: maliciousTitle,
            summary: "Just a test"
        });

        assert.strictEqual(result.isError, undefined);

        const sourcesDir = path.join(homeVaultPath, "sources");
        const files = fs.readdirSync(sourcesDir);
        const createdFile = path.join(sourcesDir, files.find(f => f.endsWith(".md"))!);

        const content = fs.readFileSync(createdFile, "utf-8");
        const lines = content.split("\n");

        const frontmatterLines = [];
        let inFrontmatter = false;
        let dashesCount = 0;
        for (const line of lines) {
            if (line === "---") {
                dashesCount++;
                if (dashesCount === 1) inFrontmatter = true;
                else if (dashesCount === 2) {
                    inFrontmatter = false;
                    break;
                }
                continue;
            }
            if (inFrontmatter) frontmatterLines.push(line);
        }

        console.log("Frontmatter lines:", frontmatterLines);

        const injectedLine = frontmatterLines.find(l => l.trim() === "key: value");
        assert.strictEqual(injectedLine, undefined, "YAML injection detected in frontmatter!");

        const titleLine = frontmatterLines.find(l => l.startsWith("title:"));
        console.log("Title line:", titleLine);

        // When we join frontmatter lines, the backslashes might be different depending on how we split.
        // Let's check if the raw content has the correctly escaped string.
        assert.ok(content.includes('title: "Vulnerable Title\\nkey: value\\n---"'), "Title should be correctly escaped and quoted in content");

        if (fs.existsSync(homeVaultPath)) fs.rmSync(homeVaultPath, { recursive: true, force: true });
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
