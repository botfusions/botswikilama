import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import { validateVaultPath } from "../../src/wiki/core.js";
import { handleWikiSetup } from "../../src/server/handlers.js";

let HOME_TMP: string;
let OUTSIDE_TMP: string;

beforeEach(() => {
  HOME_TMP = fs.mkdtempSync(path.join(os.homedir(), "lemma-symlink-test-"));
  OUTSIDE_TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-outside-test-"));
});

afterEach(() => {
  fs.rmSync(HOME_TMP, { recursive: true, force: true });
  fs.rmSync(OUTSIDE_TMP, { recursive: true, force: true });
});

describe("Wiki Symlink Vault Security", () => {
  test("allows legitimate vault paths inside home directory", () => {
    const validVault = path.join(HOME_TMP, "my-vault");
    const resolved = validateVaultPath(validVault);
    assert.equal(resolved, validVault);
  });

  test("blocks symlink pointing outside home directory in validateVaultPath", () => {
    const symlinkVault = path.join(HOME_TMP, "symlink-vault");
    fs.symlinkSync(OUTSIDE_TMP, symlinkVault, "dir");

    assert.throws(
      () => validateVaultPath(symlinkVault),
      /Access denied: Path must be within home directory/
    );
  });

  test("blocks symlink pointing outside home directory in handleWikiSetup", async () => {
    const symlinkVault = path.join(HOME_TMP, "symlink-vault-handler");
    fs.symlinkSync(OUTSIDE_TMP, symlinkVault, "dir");

    const result = await handleWikiSetup({ vault_path: symlinkVault });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Access denied/);
  });
});
