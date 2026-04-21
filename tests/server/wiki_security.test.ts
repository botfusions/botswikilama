import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as handlers from "../../src/server/handlers.js";
import os from "os";
import path from "path";
import fs from "fs";

describe("Wiki Security - Path Traversal", () => {
  test("wiki_setup should NOT allow paths outside home directory", async () => {
    const escapePath = path.join(os.tmpdir(), "lemma-traversal-test");

    if (fs.existsSync(escapePath)) {
      fs.rmSync(escapePath, { recursive: true, force: true });
    }

    const result = await handlers.handleWikiSetup({
      vault_path: escapePath,
      project_name: "Exploit"
    });

    assert.strictEqual(result.isError, true, "wiki_setup should block outside paths");
    assert.ok(result.content[0].text.includes("Vault must be located within your home directory"), "Error message should mention home directory restriction");
    assert.ok(!fs.existsSync(path.join(escapePath, "index.md")), "File should NOT have been created outside home directory");
  });

  test("wiki_setup should NOT allow traversal sequences targeting outside home", async () => {
    // We explicitly use a string with '..' to test the check
    const traversalPath = os.homedir() + "/../../tmp/lemma-traversal-repro";

    const result = await handlers.handleWikiSetup({
      vault_path: traversalPath,
      project_name: "Exploit"
    });

    assert.strictEqual(result.isError, true, "wiki_setup should block traversal sequences targeting outside home");
    assert.ok(result.content[0].text.includes("forbidden sequences"), "Error message should mention forbidden sequences");
  });

  test("wiki_setup should NOT allow paths with '..' even if inside home", async () => {
     const traversalPath = os.homedir() + "/.lemma/../lemma-traversal-inside";

     const result = await handlers.handleWikiSetup({
        vault_path: traversalPath,
        project_name: "Exploit"
      });

      assert.strictEqual(result.isError, true, "wiki_setup should block paths with '..'");
      assert.ok(result.content[0].text.includes("forbidden sequences"), "Error message should mention forbidden sequences");
  });

  test("wiki_setup should NOT allow paths that share prefix with home but are not inside it", async () => {
    const home = os.homedir();
    // Prefix attack: /home/jules_backup
    const prefixPath = home + "_backup";

    const result = await handlers.handleWikiSetup({
      vault_path: prefixPath,
      project_name: "Exploit"
    });

    assert.strictEqual(result.isError, true, "wiki_setup should block paths that share prefix with home");
    assert.ok(result.content[0].text.includes("Vault must be located within your home directory"), "Error message should mention home directory restriction");
  });
});
