import os from "os";
import path from "path";
import fs from "fs";

const SESSION_LOG_DIR = path.join(os.homedir(), ".lemma", "sessions");
let _logDir = null;

export function setSessionLogDir(dir) {
  _logDir = dir;
}

function getLogDir() {
  return _logDir || SESSION_LOG_DIR;
}

function ensureLogDir() {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

let currentVirtualSession = null;
let sessionTimeout = null;
let config = { timeout_minutes: 30 };

export function setVirtualSessionConfig(cfg) {
  if (cfg) config = cfg;
}

export function recordToolCall(toolName, args, result) {
  const entry = {
    tool: toolName,
    timestamp: new Date().toISOString(),
    args_summary: summarizeArgs(toolName, args),
    result_summary: summarizeResult(result),
  };

  if (!currentVirtualSession) {
    currentVirtualSession = {
      id: "vs_" + Date.now().toString(36),
      started_at: new Date().toISOString(),
      tool_calls: [],
      project: null,
      technologies_seen: new Set(),
      guides_used: new Set(),
      memories_accessed: [],
      memories_created: [],
    };
  }

  currentVirtualSession.tool_calls.push(entry);

  extractSessionData(toolName, args, result, currentVirtualSession);

  resetTimeout();

  return currentVirtualSession;
}

function resetTimeout() {
  if (sessionTimeout) clearTimeout(sessionTimeout);
  sessionTimeout = setTimeout(() => {
    finalizeVirtualSession();
  }, config.timeout_minutes * 60 * 1000);
}

function summarizeArgs(tool, args) {
  if (!args) return null;
  switch (tool) {
    case "memory_read":
      return args.id ? `id=${args.id}` : args.query ? `query=${args.query}` : "list";
    case "memory_add":
      return args.title || args.fragment?.slice(0, 50);
    case "guide_practice":
      return args.guide;
    case "memory_feedback":
      return `${args.id} useful=${args.useful}`;
    default:
      return null;
  }
}

function summarizeResult(result) {
  if (!result?.content?.[0]?.text) return null;
  const text = result.content[0].text;
  if (text.length > 100) return text.slice(0, 100) + "...";
  return text;
}

function extractSessionData(tool, args, result, session) {
  switch (tool) {
    case "memory_read":
      if (args?.id) session.memories_accessed.push(args.id);
      break;
    case "memory_add":
      if (args?.project) session.project = args.project;
      if (args?.title) session.memories_created.push(args.title);
      break;
    case "guide_practice":
      if (args?.guide) session.guides_used.add(args.guide.toLowerCase());
      if (args?.contexts) {
        for (const c of args.contexts) session.technologies_seen.add(c.toLowerCase());
      }
      break;
    case "memory_feedback":
      break;
  }
}

export function finalizeVirtualSession() {
  if (!currentVirtualSession || currentVirtualSession.tool_calls.length === 0) {
    currentVirtualSession = null;
    return null;
  }

  const session = {
    ...currentVirtualSession,
    ended_at: new Date().toISOString(),
    duration_tool_calls: currentVirtualSession.tool_calls.length,
    technologies: [...currentVirtualSession.technologies_seen],
    guides_used: [...currentVirtualSession.guides_used],
  };

  delete session.technologies_seen;

  ensureLogDir();
  const filePath = path.join(getLogDir(), `${session.id}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");
  } catch {}

  currentVirtualSession = null;
  if (sessionTimeout) {
    clearTimeout(sessionTimeout);
    sessionTimeout = null;
  }

  return session;
}

export function getCurrentVirtualSession() {
  return currentVirtualSession;
}

export function getRecentSessions(count = 10) {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) return [];
  
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith("vs_") && f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, count);
    
    return files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
      } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}
