import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as handlers from "../../src/server/handlers.js";
import os from "os";
import path from "path";

describe("Wiki Path Traversal Security", () => {
  test("wiki_setup should fail for paths outside home directory", async () => {
    const result = await handlers.handleWikiSetup({
      vault_path: "/tmp/malicious_wiki",
      project_name: "evil"
    });

    assert.ok(result.isError, "Should fail for paths outside home directory");
    assert.ok(result.content[0].text.includes("restricted"), `Error message should mention restriction, got: ${result.content[0].text}`);
  });

  test("wiki_setup should block '..' sequences", async () => {
    const home = os.homedir();
    const maliciousPath = path.join(home, ".lemma", "..", "..", "malicious");
    const result = await handlers.handleWikiSetup({
      vault_path: maliciousPath,
      project_name: "evil"
    });

    assert.ok(result.isError, "Should fail for paths with '..' sequences");
  });

  test("wiki_query should fail for paths outside home directory", async () => {
    const result = await handlers.handleWikiQuery({
      vault_path: "/tmp/malicious_wiki",
      query: "test"
    });

    assert.ok(result.isError, "Should fail for paths outside home directory");
  });

  test("wiki_lint should fail for paths outside home directory", async () => {
    const result = await handlers.handleWikiLint({
      vault_path: "/tmp/malicious_wiki"
    });

    assert.ok(result.isError, "Should fail for paths outside home directory");
  });
});
