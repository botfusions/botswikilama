import { test, describe } from "node:test";
import assert from "node:assert";
import os from "os";
import { redactPath } from "../../src/wiki/core.js";

describe("Path Redaction Robustness Unit Tests", () => {
  const homeDir = os.homedir();

  test("should redact the standard home directory path", () => {
    const text = `The file is located at ${homeDir}/documents/info.txt`;
    const redacted = redactPath(text);
    assert.strictEqual(redacted, "The file is located at ~/documents/info.txt");
  });

  test("should redact the home directory path regardless of casing", () => {
    const upperHome = homeDir.toUpperCase();
    const lowerHome = homeDir.toLowerCase();

    const textUpper = `The file is located at ${upperHome}/documents/info.txt`;
    const textLower = `The file is located at ${lowerHome}/documents/info.txt`;

    assert.strictEqual(redactPath(textUpper), "The file is located at ~/documents/info.txt");
    assert.strictEqual(redactPath(textLower), "The file is located at ~/documents/info.txt");
  });

  test("should be slash-agnostic (handles both backslashes and forward slashes interchangeable)", () => {
    // Replace all forward slashes with backslashes or vice versa
    const withBackslashes = homeDir.replace(/\//g, "\\");
    const withForwardSlashes = homeDir.replace(/\\/g, "/");

    const text1 = `Path: ${withBackslashes}\\documents\\info.txt`;
    const text2 = `Path: ${withForwardSlashes}/documents/info.txt`;

    assert.strictEqual(redactPath(text1), "Path: ~\\documents\\info.txt");
    assert.strictEqual(redactPath(text2), "Path: ~/documents/info.txt");
  });

  test("should not redact paths that only partially match home directory prefix", () => {
    const fakeHome = homeDir + "extra";
    const text = `The fake home is ${fakeHome}/documents/info.txt`;
    const redacted = redactPath(text);
    assert.strictEqual(redacted, text);
  });
});
