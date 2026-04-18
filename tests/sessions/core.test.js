import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import {
  setSessionsDir,
  createSession,
  loadSessions,
  saveSessions,
  findSession,
  findActiveSession,
  endSession,
  getRecentSessions,
  getSessionsByTechnology,
  calculateSuccessRate,
  formatSessionDetail,
} from "../../src/sessions/index.js";

let TMPDIR;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-session-test-"));
  setSessionsDir(TMPDIR);
});

afterEach(() => {
  setSessionsDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("Sessions Core", () => {
  describe("createSession", () => {
    test("creates session with correct defaults", () => {
      const s = createSession("debugging");
      assert.equal(s.status, "active");
      assert.equal(s.task_type, "debugging");
      assert.deepEqual(s.guides_used, []);
      assert.deepEqual(s.memories_read, []);
      assert.deepEqual(s.memories_created, []);
      assert.deepEqual(s.lessons, []);
      assert.equal(s.task_outcome, null);
      assert.equal(s.refinement_attempts, 0);
      assert.equal(s.self_critique_count, 0);
      assert.equal(s.initial_approach, null);
      assert.equal(s.final_approach, null);
      assert.equal(s.approach_changed, false);
    });

    test("stores task type and technologies", () => {
      const s = createSession("implementation", ["react", "typescript"]);
      assert.equal(s.task_type, "implementation");
      assert.equal(s.technology, "react,typescript");
    });

    test("stores empty technology string when no technologies", () => {
      const s = createSession("research");
      assert.equal(s.technology, "");
    });

    test("generates unique trace IDs", () => {
      const s1 = createSession("debugging");
      const s2 = createSession("debugging");
      assert.notEqual(s1.id, s2.id);
      assert.ok(s1.id.startsWith("t"));
    });

    test("generates unique session IDs", () => {
      const s1 = createSession("debugging");
      const s2 = createSession("debugging");
      assert.notEqual(s1.session_id, s2.session_id);
      assert.ok(s1.session_id.startsWith("s"));
    });

    test("sets timestamp as ISO string", () => {
      const s = createSession("debugging");
      assert.ok(typeof s.timestamp === "string");
      assert.ok(!isNaN(Date.parse(s.timestamp)));
    });
  });

  describe("loadSessions", () => {
    test("returns empty array when no file exists", () => {
      assert.deepEqual(loadSessions(), []);
    });

    test("persists and reloads sessions", () => {
      const s = createSession("debugging", ["node"]);
      saveSessions([s]);
      const loaded = loadSessions();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].session_id, s.session_id);
      assert.equal(loaded[0].task_type, "debugging");
      assert.equal(loaded[0].technology, "node");
    });
  });

  describe("saveSessions", () => {
    test("refuses empty array (safety check)", () => {
      const s = createSession("seed");
      saveSessions([s]);

      saveSessions([]);

      const loaded = loadSessions();
      assert.equal(loaded.length, 1);
    });

    test("creates cumulative backup", () => {
      const s1 = createSession("first");
      saveSessions([s1]);

      const s2 = createSession("second");
      saveSessions([s2]);

      const bakPath = path.join(TMPDIR, "sessions.jsonl.bak");
      const bakContent = fs.readFileSync(bakPath, "utf-8");
      const bakEntries = bakContent.trim().split("\n");
      assert.equal(bakEntries.length, 2);
    });
  });

  describe("findSession", () => {
    test("finds session by session_id", () => {
      const s = createSession("debugging");
      const found = findSession([s], s.session_id);
      assert.equal(found.session_id, s.session_id);
    });

    test("returns null for non-existent session_id", () => {
      assert.equal(findSession([], "nope"), null);
    });
  });

  describe("findActiveSession", () => {
    test("finds active session", () => {
      const s = createSession("debugging");
      const found = findActiveSession([s]);
      assert.equal(found.session_id, s.session_id);
    });

    test("returns null when all completed", () => {
      const s = createSession("debugging");
      endSession(s, "success");
      assert.equal(findActiveSession([s]), null);
    });
  });

  describe("endSession", () => {
    test("sets status to completed", () => {
      const s = createSession("debugging");
      endSession(s, "success");
      assert.equal(s.status, "completed");
    });

    test("stores outcome and lessons", () => {
      const s = createSession("debugging");
      endSession(s, "failure", "tried different approach", ["need better logs"]);
      assert.equal(s.task_outcome, "failure");
      assert.equal(s.final_approach, "tried different approach");
      assert.deepEqual(s.lessons, ["need better logs"]);
    });

    test("sets completed_at timestamp", () => {
      const s = createSession("debugging");
      endSession(s, "success");
      assert.ok(s.completed_at);
      assert.ok(!isNaN(Date.parse(s.completed_at)));
    });
  });

  describe("getRecentSessions", () => {
    test("returns sorted by timestamp newest first", () => {
      const s1 = createSession("first");
      s1.timestamp = "2025-01-01T00:00:00Z";
      endSession(s1, "success");

      const s2 = createSession("second");
      s2.timestamp = "2025-06-01T00:00:00Z";
      endSession(s2, "success");

      const recent = getRecentSessions([s1, s2]);
      assert.equal(recent[0].task_type, "second");
      assert.equal(recent[1].task_type, "first");
    });

    test("respects limit parameter", () => {
      const sessions = [];
      for (let i = 0; i < 20; i++) {
        const s = createSession(`task-${i}`);
        endSession(s, "success");
        sessions.push(s);
      }
      const recent = getRecentSessions(sessions, 5);
      assert.equal(recent.length, 5);
    });

    test("only returns completed sessions", () => {
      const active = createSession("active");
      const completed = createSession("done");
      endSession(completed, "success");

      const recent = getRecentSessions([active, completed]);
      assert.equal(recent.length, 1);
      assert.equal(recent[0].status, "completed");
    });
  });

  describe("getSessionsByTechnology", () => {
    test("filters by technology name case-insensitive", () => {
      const s1 = createSession("impl", ["React"]);
      const s2 = createSession("impl", ["Vue"]);
      const s3 = createSession("impl", ["REACT", "TypeScript"]);

      const result = getSessionsByTechnology([s1, s2, s3], "react");
      assert.equal(result.length, 2);
    });

    test("returns empty for no matching technology", () => {
      const s = createSession("impl", ["React"]);
      assert.equal(getSessionsByTechnology([s], "python").length, 0);
    });
  });

  describe("calculateSuccessRate", () => {
    test("returns correct ratio", () => {
      const s1 = createSession("a");
      endSession(s1, "success");
      const s2 = createSession("b");
      endSession(s2, "failure");
      const s3 = createSession("c");
      endSession(s3, "success");

      const rate = calculateSuccessRate([s1, s2, s3]);
      assert.ok(Math.abs(rate - 2 / 3) < 0.001);
    });

    test("returns null for no completed sessions", () => {
      const s = createSession("active");
      assert.equal(calculateSuccessRate([s]), null);
    });

    test("returns 1 for all successes", () => {
      const s1 = createSession("a");
      endSession(s1, "success");
      const s2 = createSession("b");
      endSession(s2, "success");

      assert.equal(calculateSuccessRate([s1, s2]), 1);
    });

    test("returns 0 for all failures", () => {
      const s1 = createSession("a");
      endSession(s1, "failure");
      const s2 = createSession("b");
      endSession(s2, "failure");

      assert.equal(calculateSuccessRate([s1, s2]), 0);
    });
  });

  describe("formatSessionDetail", () => {
    test("formats all fields", () => {
      const s = createSession("implementation", ["react"]);
      endSession(s, "success", "used hooks", ["keep it simple"]);
      s.guides_used = ["react"];
      s.memories_read = ["m123", "m456"];
      s.memories_created = ["m789"];

      const output = formatSessionDetail(s);
      assert.ok(output.includes(s.session_id));
      assert.ok(output.includes(s.id));
      assert.ok(output.includes("completed"));
      assert.ok(output.includes("implementation"));
      assert.ok(output.includes("react"));
      assert.ok(output.includes("success"));
      assert.ok(output.includes("react"));
      assert.ok(output.includes("2"));
      assert.ok(output.includes("1"));
      assert.ok(output.includes("keep it simple"));
      assert.ok(output.includes("used hooks"));
    });

    test("returns not found for null", () => {
      assert.equal(formatSessionDetail(null), "Session not found.");
    });
  });
});
