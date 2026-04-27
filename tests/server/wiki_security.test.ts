import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import os from "os";
import * as handlers from "../../src/server/handlers.js";

describe("Wiki Security - Path Traversal", () => {
  test("wiki_setup should block paths with ..", async () => {
    const result = await handlers.handleWikiSetup({
      vault_path: os.homedir() + "/Documents/../.ssh"
    });
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path") || result.content[0].text.includes("Traversal"), `Expected error message about invalid path, got: ${result.content[0].text}`);
  });

  test("wiki_setup should block paths outside home directory", async () => {
    const result = await handlers.handleWikiSetup({
      vault_path: "/tmp/malicious-vault"
    });
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Invalid vault path") || result.content[0].text.includes("home directory"), `Expected error message about invalid path, got: ${result.content[0].text}`);
  });

  test("wiki_ingest should block invalid paths", async () => {
    const result = await handlers.handleWikiIngest({
      vault_path: "/etc",
      summary: "test"
    });
    assert.strictEqual(result.isError, true);
  });

  test("wiki_query should block invalid paths", async () => {
    const result = await handlers.handleWikiQuery({
      vault_path: "/etc",
      query: "test"
    });
    assert.strictEqual(result.isError, true);
  });

  test("wiki_lint should block invalid paths", async () => {
    const result = await handlers.handleWikiLint({
      vault_path: "/etc"
    });
    assert.strictEqual(result.isError, true);
  });
});
