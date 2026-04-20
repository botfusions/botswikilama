import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import * as handlers from "../../src/server/handlers.js";

describe("Wiki Security", () => {
  test("handleWikiSetup rejects path traversal", async () => {
    const maliciousPath = "some/vault/../../malicious";
    const result = await handlers.handleWikiSetup({
      vault_path: maliciousPath
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Path traversal detected"));
  });

  test("handleWikiIngest rejects path traversal", async () => {
    const maliciousPath = "../../etc/passwd";
    const result = await handlers.handleWikiIngest({
      vault_path: maliciousPath,
      summary: "test"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Path traversal detected"));
  });

  test("handleWikiQuery rejects path traversal", async () => {
    const maliciousPath = "some/vault/../../hidden";
    const result = await handlers.handleWikiQuery({
      vault_path: maliciousPath,
      query: "test"
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Path traversal detected"));
  });

  test("handleWikiLint rejects path traversal", async () => {
    const maliciousPath = "/tmp/vault/../other";
    const result = await handlers.handleWikiLint({
      vault_path: maliciousPath
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Path traversal detected"));
  });
});
