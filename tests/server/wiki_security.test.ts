import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import * as handlers from "../../src/server/handlers.js";
import * as core from "../../src/memory/index.js";

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-wiki-security-test-"));
  core.setMemoryDir(TMPDIR);
});

afterEach(() => {
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("Wiki Security - Path Traversal", () => {
  test("wiki_setup should block paths outside of home directory", async () => {
    // Determine a path that is definitely outside the home directory.
    // On Unix-like systems, /tmp is usually outside /home/user.
    // On Windows, C:\Windows is outside C:\Users\user.

    let outsideHome: string;
    if (process.platform === "win32") {
      outsideHome = "C:\\Windows\\System32\\lemma-test-vault";
    } else {
      outsideHome = "/tmp/lemma-test-vault-" + Math.random().toString(36).substring(7);
    }

    const result = await handlers.handleWikiSetup({
      vault_path: outsideHome,
      project_name: "Test"
    });

    assert.strictEqual(result.isError, true, "Should have returned an error for path outside home");
    assert.ok(result.content[0].text.includes("Security violation"), "Error message should mention security violation");
    assert.ok(result.content[0].text.includes("home directory"), "Error message should mention home directory");

    // Verify directory was not created
    assert.strictEqual(fs.existsSync(outsideHome), false, "Directory outside home should not have been created");
  });

  test("wiki_setup should block paths with '..' sequences", async () => {
    // We use a raw string to ensure '..' is actually passed to the validator
    const homeDir = os.homedir();
    const traversalPath = homeDir + "/Documents/../Desktop/lemma-vault";

    const result = await handlers.handleWikiSetup({
      vault_path: traversalPath,
      project_name: "Test"
    });

    assert.strictEqual(result.isError, true, "Should have blocked path with '..' sequence");
    assert.ok(result.content[0].text.includes("Path traversal sequences ('..') are strictly prohibited"));
  });

  test("wiki_setup should allow paths inside home directory", async () => {
    const homeDir = os.homedir();
    const safePath = path.join(homeDir, ".lemma-test-vault-" + Math.random().toString(36).substring(7));

    try {
      const result = await handlers.handleWikiSetup({
        vault_path: safePath,
        project_name: "Test"
      });

      assert.strictEqual(result.isError, undefined, "Should have allowed path inside home directory");
      assert.ok(result.content[0].text.includes("Wiki vault created"), "Should indicate successful creation");
      assert.ok(fs.existsSync(safePath), "Vault directory should exist");
    } finally {
      if (fs.existsSync(safePath)) {
        fs.rmSync(safePath, { recursive: true, force: true });
      }
    }
  });

  test("wiki_setup should allow tilde expansion", async () => {
    const tildePath = "~/.lemma-test-tilde-" + Math.random().toString(36).substring(7);
    const resolvedPath = path.join(os.homedir(), tildePath.slice(2));

    try {
      const result = await handlers.handleWikiSetup({
        vault_path: tildePath,
        project_name: "Test"
      });

      assert.strictEqual(result.isError, undefined, "Should have allowed tilde expansion");
      assert.ok(fs.existsSync(resolvedPath), "Resolved tilde path should exist");
    } finally {
      if (fs.existsSync(resolvedPath)) {
        fs.rmSync(resolvedPath, { recursive: true, force: true });
      }
    }
  });
});
