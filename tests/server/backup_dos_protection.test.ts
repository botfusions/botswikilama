import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";
import * as memoryCore from "../../src/memory/core.js";
import * as guidesCore from "../../src/guides/core.js";
import * as sessionsCore from "../../src/sessions/core.js";

describe("Backup DoS Protection", () => {
  const tempDir = path.join(os.tmpdir(), `lemma-test-backup-${Date.now()}`);

  before(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    memoryCore.setMemoryDir(tempDir);
    guidesCore.setGuidesDir(tempDir);
    sessionsCore.setSessionsDir(tempDir);
  });

  after(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("memory backup should be capped at 1000 entries", () => {
    const backupFile = path.join(tempDir, "memory.jsonl.bak");

    // First save 600 fragments
    const firstBatch = [];
    for (let i = 0; i < 600; i++) {
      firstBatch.push(memoryCore.createFragment(`fragment ${i}`, "user", `title ${i}`));
    }
    memoryCore.saveMemory(firstBatch);

    // Then save another 600 unique fragments
    const secondBatch = [];
    for (let i = 600; i < 1200; i++) {
      secondBatch.push(memoryCore.createFragment(`fragment ${i}`, "user", `title ${i}`));
    }
    memoryCore.saveMemory(secondBatch);

    // Check backup size
    const content = fs.readFileSync(backupFile, "utf-8").trim();
    const count = content.split("\n").length;

    assert.ok(count <= 1000, `Backup should have at most 1000 entries, but found ${count}`);
  });

  test("guides backup should be capped at 1000 entries", () => {
    const backupFile = path.join(tempDir, "guides.jsonl.bak");

    // First save 600 guides
    const firstBatch = [];
    for (let i = 0; i < 600; i++) {
      firstBatch.push(guidesCore.createGuide(`guide ${i}`, "test", `desc ${i}`));
    }
    guidesCore.saveGuides(firstBatch);

    // Then save another 600 unique guides
    const secondBatch = [];
    for (let i = 600; i < 1200; i++) {
      secondBatch.push(guidesCore.createGuide(`guide ${i}`, "test", `desc ${i}`));
    }
    guidesCore.saveGuides(secondBatch);

    // Check backup size
    const content = fs.readFileSync(backupFile, "utf-8").trim();
    const count = content.split("\n").length;

    assert.ok(count <= 1000, `Backup should have at most 1000 entries, but found ${count}`);
  });

  test("sessions backup should be capped at 1000 entries", () => {
    const backupFile = path.join(tempDir, "sessions.jsonl.bak");

    // First save 600 sessions
    const firstBatch = [];
    for (let i = 0; i < 600; i++) {
      firstBatch.push(sessionsCore.createSession(`task ${i}`));
    }
    sessionsCore.saveSessions(firstBatch);

    // Then save another 600 unique sessions
    const secondBatch = [];
    for (let i = 600; i < 1200; i++) {
      secondBatch.push(sessionsCore.createSession(`task ${i}`));
    }
    sessionsCore.saveSessions(secondBatch);

    // Check backup size
    const content = fs.readFileSync(backupFile, "utf-8").trim();
    const count = content.split("\n").length;

    assert.ok(count <= 1000, `Backup should have at most 1000 entries, but found ${count}`);
  });
});
