import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as memoryCore from "../../src/memory/core.js";
import * as guideCore from "../../src/guides/core.js";
import * as sessionCore from "../../src/sessions/core.js";

const tmpDir = path.join(os.tmpdir(), "lemma-backup-test-" + Date.now());

test("saveMemory limits backup to 1000 entries", () => {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const memoryFile = path.join(tmpDir, "memory.jsonl");
  const backupFile = memoryFile + ".bak";
  memoryCore.setMemoryDir(tmpDir);

  // 1. Create a backup with 999 entries
  const initialFragments = Array.from({ length: 999 }, (_, i) => ({
    id: `m${i}`,
    fragment: "test",
    title: "test",
    confidence: 1.0,
    source: "ai" as const,
    created: "2025-01-01",
    lastAccessed: "2025-01-01T00:00:00Z",
    accessed: 0,
    tags: [],
    associatedWith: [],
  }));
  fs.writeFileSync(backupFile, initialFragments.map(f => JSON.stringify(f)).join("\n"), "utf-8");

  // 2. Save memory with 2 new entries
  const newFragments = [
    ...initialFragments.slice(0, 5), // existing
    { id: "new1", fragment: "test", title: "test", confidence: 1.0, source: "ai" as const, created: "2025-01-01", lastAccessed: "2025-01-01T00:00:00Z", accessed: 0, tags: [], associatedWith: [] },
    { id: "new2", fragment: "test", title: "test", confidence: 1.0, source: "ai" as const, created: "2025-01-01", lastAccessed: "2025-01-01T00:00:00Z", accessed: 0, tags: [], associatedWith: [] },
  ];

  // @ts-ignore
  memoryCore.saveMemory(newFragments);

  // 3. Verify backup has exactly 1000 entries
  const backupContent = fs.readFileSync(backupFile, "utf-8");
  const backupEntries = backupContent.trim().split("\n");
  assert.strictEqual(backupEntries.length, 1000);

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("saveGuides limits backup to 1000 entries", () => {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  guideCore.setGuidesDir(tmpDir);
  const backupFile = path.join(tmpDir, "guides.jsonl.bak");

  const initialGuides = Array.from({ length: 999 }, (_, i) => ({
    id: `g${i}`,
    guide: `guide${i}`,
    category: "test",
    learnings: [],
    contexts: [],
  }));
  fs.writeFileSync(backupFile, initialGuides.map(g => JSON.stringify(g)).join("\n"), "utf-8");

  const newGuides = [
    ...initialGuides.slice(0, 5),
    { id: "new1", guide: "new1", category: "test", learnings: [], contexts: [] },
    { id: "new2", guide: "new2", category: "test", learnings: [], contexts: [] },
  ];

  // @ts-ignore
  guideCore.saveGuides(newGuides);

  const backupContent = fs.readFileSync(backupFile, "utf-8");
  const backupEntries = backupContent.trim().split("\n");
  assert.strictEqual(backupEntries.length, 1000);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("saveSessions limits backup to 1000 entries", () => {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  sessionCore.setSessionsDir(tmpDir);
  const backupFile = path.join(tmpDir, "sessions.jsonl.bak");

  const initialSessions = Array.from({ length: 999 }, (_, i) => ({
    id: `s${i}`,
    session_id: `sid${i}`,
    status: "completed",
  }));
  fs.writeFileSync(backupFile, initialSessions.map(s => JSON.stringify(s)).join("\n"), "utf-8");

  const newSessions = [
    ...initialSessions.slice(0, 5),
    { id: "new1", session_id: "newsid1", status: "completed" },
    { id: "new2", session_id: "newsid2", status: "completed" },
  ];

  // @ts-ignore
  sessionCore.saveSessions(newSessions);

  const backupContent = fs.readFileSync(backupFile, "utf-8");
  const backupEntries = backupContent.trim().split("\n");
  assert.strictEqual(backupEntries.length, 1000);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
