import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";

let SESSIONS_DIR = path.join(os.homedir(), ".lemma");
let SESSIONS_FILE = path.join(SESSIONS_DIR, "sessions.jsonl");

export function setSessionsDir(dir) {
  SESSIONS_DIR = dir;
  SESSIONS_FILE = path.join(SESSIONS_DIR, "sessions.jsonl");
}

export function generateSessionId() {
  return "s" + crypto.randomUUID().replace(/-/g, "").substring(0, 12);
}

export function generateTraceId() {
  return "t" + crypto.randomUUID().replace(/-/g, "").substring(0, 12);
}

export function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      return [];
    }
    const content = fs.readFileSync(SESSIONS_FILE, "utf-8");
    if (!content.trim()) {
      return [];
    }
    return content
      .trim()
      .split("\n")
      .map(line => JSON.parse(line));
  } catch (error) {
    console.error("Error loading sessions:", error.message);
    return [];
  }
}

export function saveSessions(sessions, options = {}) {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if ((!sessions || sessions.length === 0) && !options.force) {
      console.warn("WARNING: Attempted to save empty sessions array - ABORTED to prevent data loss");
      return;
    }

    const jsonl = sessions && sessions.length > 0 ? sessions.map(s => JSON.stringify(s)).join("\n") : "";

    const backupFile = SESSIONS_FILE + ".bak";
    if (fs.existsSync(backupFile)) {
      try {
        const backupContent = fs.readFileSync(backupFile, "utf-8");
        const backupEntries = backupContent.trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
        const backupIds = new Set(backupEntries.map(e => e.id));
        const newEntries = sessions.filter(s => !backupIds.has(s.id));
        if (newEntries.length > 0) {
          const merged = [...backupEntries, ...newEntries];
          fs.writeFileSync(backupFile, merged.map(s => JSON.stringify(s)).join("\n"), "utf-8");
        }
      } catch {
        fs.writeFileSync(backupFile, jsonl, "utf-8");
      }
    } else {
      fs.writeFileSync(backupFile, jsonl, "utf-8");
    }

    fs.writeFileSync(SESSIONS_FILE, jsonl, "utf-8");
  } catch (error) {
    console.error("Error saving sessions:", error.message);
    throw error;
  }
}

export function createSession(taskType, technologies = []) {
  const now = new Date();
  return {
    id: generateTraceId(),
    session_id: generateSessionId(),
    timestamp: now.toISOString(),
    task_type: taskType,
    technology: technologies.join(","),
    guides_used: [],
    memories_read: [],
    memories_created: [],
    task_outcome: null,
    refinement_attempts: 0,
    self_critique_count: 0,
    initial_approach: null,
    final_approach: null,
    approach_changed: false,
    lessons: [],
    status: "active"
  };
}

export function findSession(sessions, sessionId) {
  return sessions.find(s => s.session_id === sessionId) || null;
}

export function findActiveSession(sessions) {
  return sessions.find(s => s.status === "active") || null;
}

export function endSession(session, outcome, finalApproach, lessons = []) {
  session.status = "completed";
  session.task_outcome = outcome;
  session.final_approach = finalApproach;
  session.lessons = lessons;
  session.completed_at = new Date().toISOString();
  return session;
}

export function getRecentSessions(sessions, limit = 10) {
  return [...sessions]
    .filter(s => s.status === "completed")
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export function getSessionsByTechnology(sessions, technology) {
  const lower = technology.toLowerCase();
  return sessions.filter(s =>
    s.technology && s.technology.toLowerCase().includes(lower)
  );
}

export function calculateSuccessRate(sessions) {
  const completed = sessions.filter(s => s.status === "completed" && s.task_outcome);
  if (completed.length === 0) return null;
  const successes = completed.filter(s => s.task_outcome === "success").length;
  return successes / completed.length;
}

export function formatSessionDetail(session) {
  if (!session) return "Session not found.";

  let detail = `=== SESSION DETAIL ===\n`;
  detail += `Session ID: ${session.session_id}\n`;
  detail += `Trace ID: ${session.id}\n`;
  detail += `Status: ${session.status}\n`;
  detail += `Task Type: ${session.task_type || "unknown"}\n`;
  detail += `Technology: ${session.technology || "none"}\n`;
  detail += `Started: ${session.timestamp}\n`;
  if (session.completed_at) {
    detail += `Completed: ${session.completed_at}\n`;
  }
  if (session.task_outcome) {
    detail += `Outcome: ${session.task_outcome}\n`;
  }
  if (session.guides_used && session.guides_used.length > 0) {
    detail += `Guides Used: ${session.guides_used.join(", ")}\n`;
  }
  if (session.memories_read && session.memories_read.length > 0) {
    detail += `Memories Read: ${session.memories_read.length}\n`;
  }
  if (session.memories_created && session.memories_created.length > 0) {
    detail += `Memories Created: ${session.memories_created.length}\n`;
  }
  if (session.lessons && session.lessons.length > 0) {
    detail += `Lessons:\n`;
    for (const l of session.lessons) {
      detail += `  - ${l}\n`;
    }
  }
  if (session.final_approach) {
    detail += `Final Approach: ${session.final_approach}\n`;
  }
  detail += `====================`;
  return detail;
}
