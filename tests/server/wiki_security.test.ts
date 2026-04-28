import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import os from "os";
import fs from "fs";
import * as handlers from "../../src/server/handlers.js";

describe("Wiki Security - Path Traversal", () => {
  test("FIX VERIFIED: wiki_setup should NOT allow paths outside homedir", async () => {
    const evilPath = path.join(os.tmpdir(), "lemma-evil-vault-" + Date.now());

    const result = await handlers.handleWikiSetup({
      vault_path: evilPath,
      project_name: "Exploit"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Security: Vault must be located within user home directory"));
    assert.ok(!fs.existsSync(evilPath));
  });

  test("FIX VERIFIED: wiki_setup should NOT allow '..' in paths", async () => {
    const homeDir = os.homedir();
    const traversalPath = homeDir + "/.lemma/../.ssh_fake";

    const result = await handlers.handleWikiSetup({
      vault_path: traversalPath,
      project_name: "Traversal"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Security: Path traversal sequences ('..') are not allowed"));
  });

  test("NORMAL OPERATION: wiki_setup should allow valid paths in home", async () => {
    const validPath = path.join(os.homedir(), ".lemma-test-vault-" + Date.now());

    try {
        const result = await handlers.handleWikiSetup({
          vault_path: validPath,
          project_name: "Valid"
        });

        assert.ok(!result.isError);
        assert.ok(result.content[0].text.includes("Wiki vault created"));
        assert.ok(fs.existsSync(validPath));
    } finally {
        if (fs.existsSync(validPath)) {
            fs.rmSync(validPath, { recursive: true, force: true });
        }
    }
  });
});
