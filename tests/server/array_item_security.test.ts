import { test } from "node:test";
import assert from "node:assert";
import {
  handleSessionStart,
  handleSessionEnd,
} from "../../src/server/handlers.js";

test("handleSessionStart rejects oversized technology name", async () => {
  const result = await handleSessionStart({
    task_type: "test",
    technologies: ["a".repeat(10001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'technologies' item exceeds maximum length/);
});

test("handleSessionEnd rejects oversized lesson text", async () => {
  const result = await handleSessionEnd({
    outcome: "success",
    lessons: ["a".repeat(10001)]
  });
  assert.strictEqual(result.isError, true);
  assert.match(result.content[0].text, /Error: Individual 'lessons' item exceeds maximum length/);
});
