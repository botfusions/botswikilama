import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import * as handlers from "../../src/server/handlers.js";

describe("Wiki Security", () => {
  test("wiki_setup should block paths outside homedir", async () => {
    const dangerousPath = path.join(os.tmpdir(), "lemma-dangerous-vault-" + Math.random().toString(36).substring(7));

    const result = await handlers.handleWikiSetup({
      vault_path: dangerousPath,
      project_name: "SecurityTest"
    });

    // Clean up if it was created (vulnerability exists)
    if (fs.existsSync(dangerousPath)) {
      fs.rmSync(dangerousPath, { recursive: true, force: true });
    }

    assert.strictEqual(result.isError, true, "Should have returned an error for path outside homedir");
    assert.match(result.content[0].text, /unauthorized|homedir/i);
  });

  test("wiki_setup should block '..' in paths", async () => {
    // Explicitly use '..' in the string
    const traversalPath = "/home/jules/.lemma/../fake_vault";

    const result = await handlers.handleWikiSetup({
      vault_path: traversalPath,
      project_name: "TraversalTest"
    });

    // Clean up if it was created (vulnerability exists)
    const resolved = path.resolve(traversalPath);
    if (fs.existsSync(resolved)) {
         fs.rmSync(resolved, { recursive: true, force: true });
    }

    assert.strictEqual(result.isError, true, "Should have returned an error for path with '..'");
    assert.match(result.content[0].text, /invalid path|\.\./i);
  });
});
