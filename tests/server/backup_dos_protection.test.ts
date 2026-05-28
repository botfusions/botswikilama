import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setMemoryDir, saveMemory, createFragment } from "../../src/memory/core.js";
import { setGuidesDir, saveGuides, createGuide } from "../../src/guides/core.js";
import { setSessionsDir, saveSessions, createSession } from "../../src/sessions/core.js";

test("saveMemory backup does not grow beyond 1000 entries", async () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-memory-"));
  setMemoryDir(testDir);
  const backupFile = path.join(testDir, "memory.jsonl.bak");

  try {
    // 1. Create and save 600 fragments
    const batch1 = Array.from({ length: 600 }, (_, i) => createFragment(`f1-${i}`, "ai"));
    saveMemory(batch1);

    let backupContent = fs.readFileSync(backupFile, "utf-8").trim().split("\n");
    assert.strictEqual(backupContent.length, 600);

    // 2. Create and save another 600 fragments (different IDs)
    const batch2 = Array.from({ length: 600 }, (_, i) => createFragment(`f2-${i}`, "ai"));
    saveMemory(batch2);

    backupContent = fs.readFileSync(backupFile, "utf-8").trim().split("\n");
    // Total should be 1000, not 1200
    assert.strictEqual(backupContent.length, 1000);

    // 3. Verify it's the LATEST 1000 (batch 2 + some of batch 1)
    const lastEntry = JSON.parse(backupContent[999]);
    assert.strictEqual(lastEntry.fragment, "f2-599");

    const firstEntry = JSON.parse(backupContent[0]);
    // batch1 has 600, batch2 has 600. Total 1200. We keep last 1000.
    // Index 0 should be index 200 of batch 1.
    assert.strictEqual(firstEntry.fragment, "f1-200");

  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("saveGuides backup does not grow beyond 1000 entries", async () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-guides-"));
  setGuidesDir(testDir);
  const backupFile = path.join(testDir, "guides.jsonl.bak");

  try {
    const batch1 = Array.from({ length: 600 }, (_, i) => createGuide(`g1-${i}`, "test"));
    saveGuides(batch1);

    let backupContent = fs.readFileSync(backupFile, "utf-8").trim().split("\n");
    assert.strictEqual(backupContent.length, 600);

    const batch2 = Array.from({ length: 600 }, (_, i) => createGuide(`g2-${i}`, "test"));
    saveGuides(batch2);

    backupContent = fs.readFileSync(backupFile, "utf-8").trim().split("\n");
    assert.strictEqual(backupContent.length, 1000);

  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("saveSessions backup does not grow beyond 1000 entries", async () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-test-sessions-"));
  setSessionsDir(testDir);
  const backupFile = path.join(testDir, "sessions.jsonl.bak");

  try {
    const batch1 = Array.from({ length: 600 }, (_, i) => createSession(`s1-${i}`));
    saveSessions(batch1);

    let backupContent = fs.readFileSync(backupFile, "utf-8").trim().split("\n");
    assert.strictEqual(backupContent.length, 600);

    const batch2 = Array.from({ length: 600 }, (_, i) => createSession(`s2-${i}`));
    saveSessions(batch2);

    backupContent = fs.readFileSync(backupFile, "utf-8").trim().split("\n");
    assert.strictEqual(backupContent.length, 1000);

  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
