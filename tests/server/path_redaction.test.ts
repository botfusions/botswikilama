import { test, describe } from "node:test";
import assert from "node:assert";
import os from "os";
import { handleCallTool } from "../../src/server/handlers.js";
import { redactPath } from "../../src/wiki/index.js";

describe("Path Redaction Security", () => {
  const homeDir = os.homedir();

  test("should redact home directory in successful tool output", async () => {
    // We use wiki_setup as it often returns the full path
    const vaultPath = `${homeDir}/.lemma/test-vault`;
    const result = await handleCallTool({
      params: {
        name: "wiki_setup",
        arguments: {
          vault_path: vaultPath,
          project_name: "Test Project"
        }
      }
    });

    for (const item of result.content) {
      if (item.type === "text") {
        assert.ok(!item.text.includes(homeDir), `Output should not contain absolute home path: ${item.text}`);
        assert.ok(item.text.includes("~"), `Output should contain redacted tilde path: ${item.text}`);
      }
    }
  });

  test("should redact home directory in error messages", async () => {
    // Attempting to access a path outside home dir triggers an error from validateVaultPath
    // which normally includes the home directory path in its access denied message.
    const result = await handleCallTool({
      params: {
        name: "wiki_setup",
        arguments: {
          vault_path: "/etc/passwd",
          project_name: "Malicious"
        }
      }
    });

    assert.strictEqual(result.isError, true);
    for (const item of result.content) {
      if (item.type === "text") {
        assert.ok(!item.text.includes(homeDir), `Error message should not contain absolute home path: ${item.text}`);
        assert.ok(item.text.includes("~"), `Error message should contain redacted tilde path: ${item.text}`);
      }
    }
  });

  test("should redact home directory case-insensitively and slash-agnostically", () => {
    const rawHome = os.homedir();

    // Generate mixed casing and mixed slashes of home directory
    const upperHome = rawHome.toUpperCase();
    const lowerHome = rawHome.toLowerCase();
    const forwardHome = rawHome.replace(/\\/g, "/");
    const backHome = rawHome.replace(/\//g, "\\");

    // Assert that redactPath is case-insensitive and slash-agnostic
    assert.ok(redactPath(upperHome).includes("~"), `Should redact uppercase home directory: ${upperHome}`);
    assert.ok(redactPath(lowerHome).includes("~"), `Should redact lowercase home directory: ${lowerHome}`);
    assert.ok(redactPath(`${forwardHome}/subdir`).includes("~"), `Should redact forward-slash home directory: ${forwardHome}`);
    assert.ok(redactPath(`${backHome}\\subdir`).includes("~"), `Should redact backslash home directory: ${backHome}`);
  });
});
