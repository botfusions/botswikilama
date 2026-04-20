import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";
import * as sessions from "../sessions/index.js";
import * as virtualSession from "../sessions/virtual.js";
import * as wiki from "../wiki/index.js";
import path from "path";
import fs from "fs";

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface SessionStartArgs {
  task_type?: string;
  technologies?: string[];
  initial_approach?: string;
}

interface SessionEndArgs {
  outcome?: string;
  final_approach?: string;
  lessons?: string[];
}

interface MemoryReadArgs {
  project?: string;
  query?: string;
  id?: string;
  context?: string;
  all?: boolean;
  ids?: string[];
}

interface MemoryAddArgs {
  fragment?: string;
  title?: string;
  description?: string;
  project?: string | null;
  source?: string;
}

interface MemoryUpdateArgs {
  id?: string;
  title?: string;
  fragment?: string;
  confidence?: number;
}

interface MemoryForgetArgs {
  id?: string;
}

interface MemoryFeedbackArgs {
  id?: string;
  useful?: boolean;
}

interface MemoryMergeArgs {
  ids?: string[];
  title?: string;
  fragment?: string;
  project?: string | null;
}

interface MemoryStatsArgs {
  project?: string;
}

interface GuideGetArgs {
  category?: string;
  guide?: string;
  task?: string;
}

interface GuidePracticeArgs {
  guide?: string;
  category?: string;
  description?: string;
  contexts?: string[];
  learnings?: string[];
  outcome?: string;
}

interface GuideCreateArgs {
  guide?: string;
  category?: string;
  description?: string;
  contexts?: string[];
  learnings?: string[];
}

interface GuideDistillArgs {
  memory_id?: string;
  guide?: string;
  category?: string;
}

interface GuideUpdateArgs {
  guide?: string;
  new_name?: string;
  category?: string;
  description?: string;
  add_anti_patterns?: string[];
  add_pitfalls?: string[];
  superseded_by?: string;
  deprecated?: boolean;
}

interface GuideForgetArgs {
  guide?: string;
}

interface GuideMergeArgs {
  guides?: string[];
  guide?: string;
  category?: string;
  description?: string;
  contexts?: string[];
  learnings?: string[];
}

interface SessionStatsArgs {
  count?: number;
}

interface WikiSetupArgs {
  vault_path?: string;
  project_name?: string;
  language?: string;
}

interface WikiIngestArgs {
  vault_path?: string;
  file_path?: string;
  title?: string;
  summary?: string;
  entities?: string[];
  concepts?: string[];
  decisions?: string[];
}

interface WikiQueryArgs {
  vault_path?: string;
  query?: string;
}

interface WikiLintArgs {
  vault_path?: string;
}

interface ToolCallRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

let activeSessionId: string | null = null;

/**
 * Validates that the vault path is safe and doesn't contain traversal sequences.
 */
function validateVaultPath(vaultPath: string): void {
  if (!vaultPath) {
    throw new Error("'vault_path' is required");
  }

  // Prevent path traversal attempts
  const normalized = path.normalize(vaultPath);
  if (normalized.includes("..") || vaultPath.includes("..")) {
    throw new Error("Invalid 'vault_path': Path traversal detected");
  }
}

let _notifyChange: (() => void) | null = null;

export function setNotifyChange(fn: () => void): void {
  _notifyChange = fn;
}

function notifyMemoryChange(): void {
  if (_notifyChange) _notifyChange();
}

export async function handleSessionStart(args?: SessionStartArgs): Promise<ToolResult> {
  const taskType = args?.task_type;
  const technologies = args?.technologies || [];
  const initialApproach = args?.initial_approach || null;

  if (!taskType) {
    return {
      content: [{ type: "text", text: "Error: 'task_type' parameter is required" }],
      isError: true,
    };
  }

  const allSessions = sessions.loadSessions();
  const existing = sessions.findActiveSession(allSessions);
  if (existing) {
    existing.status = "abandoned";
    existing.task_outcome = "abandoned";
  }

  const session = sessions.createSession(taskType, technologies);
  session.initial_approach = initialApproach;
  activeSessionId = session.session_id;
  allSessions.push(session);
  sessions.saveSessions(allSessions);

  const allGuides = guides.loadGuides();
  const taskDesc = [taskType, ...technologies].join(" ");
  const suggestions = guides.suggestGuides(taskDesc, allGuides);
  const formattedSuggestions = guides.formatSuggestions(suggestions);

  let response = `Session started: ${session.session_id} (${taskType})\n`;
  if (technologies.length > 0) {
    response += `Technologies: ${technologies.join(", ")}\n`;
  }
  response += `\n${formattedSuggestions}`;

  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleSessionEnd(args?: SessionEndArgs): Promise<ToolResult> {
  const outcome = args?.outcome;
  const finalApproach = args?.final_approach || null;
  const lessons = args?.lessons || [];

  if (!outcome) {
    return {
      content: [{ type: "text", text: "Error: 'outcome' parameter is required" }],
      isError: true,
    };
  }

  const allSessions = sessions.loadSessions();
  const session = activeSessionId
    ? sessions.findSession(allSessions, activeSessionId)
    : sessions.findActiveSession(allSessions);

  if (!session) {
    return {
      content: [{ type: "text", text: "Error: No active session to end." }],
      isError: true,
    };
  }

  sessions.endSession(session, outcome, finalApproach, lessons);

  const allGuides = guides.loadGuides();
  const improvementLines: string[] = [];

  if (session.guides_used && session.guides_used.length > 0) {
    for (const guideName of session.guides_used) {
      const guide = guides.findGuide(allGuides, guideName);
      if (guide) {
        if (outcome === "success") {
          guide.success_count = (guide.success_count || 0) + 1;
        } else if (outcome === "failure") {
          guide.failure_count = (guide.failure_count || 0) + 1;
          const total = (guide.success_count || 0) + (guide.failure_count || 0);
          if (total >= 3) {
            const rate = guide.success_count / total;
            if (rate < 0.4) {
              improvementLines.push(`  [!] Guide "${guideName}" success rate is ${rate.toFixed(2)} (${guide.success_count}/${total}). Consider refining with guide_update.`);
            }
          }
        }
      }
    }
    guides.saveGuides(allGuides);
  }

  sessions.saveSessions(allSessions);
  activeSessionId = null;

  let response = `Session ${session.session_id} ended: ${outcome}\n`;
  response += `Task: ${session.task_type} | Duration: ${session.timestamp} → ${session.completed_at}\n`;
  if (lessons.length > 0) {
    response += `Lessons: ${lessons.length} recorded\n`;
  }
  if (improvementLines.length > 0) {
    response += `\nIMPROVEMENT SUGGESTIONS:\n${improvementLines.join("\n")}\n`;
  }

  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleMemoryRead(args?: MemoryReadArgs): Promise<ToolResult> {
  const currentProject = args?.project || core.detectProject();
  const query = args?.query || null;
  const detailId = args?.id || null;
  const context = args?.context || null;
  const showAll = args?.all === true;

  let memory: any[] = core.loadMemory();

  const detailIds = args?.ids || null;
  if (detailIds && Array.isArray(detailIds) && detailIds.length > 0) {
    const results: string[] = [];
    for (const did of detailIds) {
      const fragment = memory.find((f: any) => f.id === did);
      if (fragment) {
        const boosted = core.boostOnAccess(fragment, context);
        Object.assign(fragment, boosted);
        results.push(core.formatMemoryDetail(fragment));
      } else {
        results.push(`Fragment [${did}] not found.`);
      }
    }
    core.saveMemory(memory);
    notifyMemoryChange();
    return {
      content: [{ type: "text", text: results.join("\n\n") }],
    };
  }

  if (detailId) {
    const fragment = memory.find((f: any) => f.id === detailId);
    if (!fragment) {
      return {
        content: [{ type: "text", text: `Error: Fragment with ID '${detailId}' not found` }],
        isError: true,
      };
    }
    const boosted = core.boostOnAccess(fragment, context);
    Object.assign(fragment, boosted);
    core.saveMemory(memory);
    notifyMemoryChange();

    return {
      content: [{ type: "text", text: core.formatMemoryDetail(fragment) }],
    };
  }

  const filteredMemory = showAll
    ? memory
    : core.filterByProject(memory, currentProject);

  const results = core.searchAndSortFragments(filteredMemory, query, 30);

  const resultIds = new Set((results as any[]).map((r: any) => r.id));
  for (const frag of memory) {
    if (resultIds.has(frag.id)) {
      const boosted = core.boostOnAccess(frag, context);
      Object.assign(frag, boosted);
    }
  }

  const scopeInfo = showAll ? "all projects" : currentProject || "global";
  const formatted = core.formatMemoryForLLM(results, scopeInfo);
  core.saveMemory(memory);
  notifyMemoryChange();
  return {
    content: [{ type: "text", text: formatted }],
  };
}

export async function handleMemoryAdd(args?: MemoryAddArgs): Promise<ToolResult> {
  const fragment = args?.fragment;
  const title = args?.title || null;
  const description = args?.description || null;
  const project = args?.project === undefined ? null : args.project;
  const source = (args?.source || "ai") as "user" | "ai";

  if (!fragment || typeof fragment !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'fragment' parameter is required and must be a string" }],
      isError: true,
    };
  }

  const memory: any[] = core.loadMemory();

  const similarMatch = core.findSimilarFragment(memory, fragment, project);
  if (similarMatch) {
    return {
      content: [{
        type: "text",
        text: `A similar memory already exists [${similarMatch.id}]: "${similarMatch.title}"\nUse memory_update on [${similarMatch.id}] if you want to modify it.`
      }],
      isError: true,
    };
  }

  const newFragment = core.createFragment(fragment, source, title, project, description);
  if (activeSessionId) {
    const allSessions = sessions.loadSessions();
    const session = sessions.findSession(allSessions, activeSessionId);
    if (session) {
      newFragment.session_id = activeSessionId;
      newFragment.task_type = session.task_type;
      session.memories_created = session.memories_created || [];
      session.memories_created.push(newFragment.id);
      sessions.saveSessions(allSessions);
    }
  }
  memory.push(newFragment);
  core.saveMemory(memory);
  notifyMemoryChange();

  const scopeInfo = newFragment.project ? ` (project: ${newFragment.project})` : " (global)";
  return {
    content: [{ type: "text", text: `Added fragment [${newFragment.id}]${scopeInfo}: "${newFragment.title}"\nSummary: ${newFragment.description}` }],
  };
}

export async function handleMemoryUpdate(args?: MemoryUpdateArgs): Promise<ToolResult> {
  const id = args?.id;
  const title = args?.title;
  const fragment = args?.fragment;
  const confidence = args?.confidence;

  if (!id || typeof id !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'id' parameter is required and must be a string" }],
      isError: true,
    };
  }

  const memory: any[] = core.loadMemory();
  const targetIndex = memory.findIndex((f: any) => f.id === id);

  if (targetIndex === -1) {
    return {
      content: [{ type: "text", text: `Error: Fragment with ID '${id}' not found` }],
      isError: true,
    };
  }

  if (title !== undefined) {
    if (typeof title !== "string") {
      return {
        content: [{ type: "text", text: "Error: 'title' must be a string" }],
        isError: true,
      };
    }
    memory[targetIndex].title = title;
  }

  if (fragment !== undefined) {
    if (typeof fragment !== "string") {
      return {
        content: [{ type: "text", text: "Error: 'fragment' must be a string" }],
        isError: true,
      };
    }
    memory[targetIndex].fragment = fragment;
    memory[targetIndex].accessed++;
  }

  if (confidence !== undefined) {
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
      return {
        content: [{ type: "text", text: "Error: 'confidence' must be a number between 0 and 1" }],
        isError: true,
      };
    }
    memory[targetIndex].confidence = confidence;
  }

  core.saveMemory(memory);
  notifyMemoryChange();

  return {
    content: [{ type: "text", text: `Updated fragment [${id}]: "${memory[targetIndex].title}"` }],
  };
}

export async function handleMemoryForget(args?: MemoryForgetArgs): Promise<ToolResult> {
  const id = args?.id;

  if (!id || typeof id !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'id' parameter is required and must be a string" }],
      isError: true,
    };
  }

  const memory: any[] = core.loadMemory();
  const initialLength = memory.length;
  const filtered = memory.filter((f: any) => f.id !== id);

  if (filtered.length === initialLength) {
    return {
      content: [{ type: "text", text: `Error: Fragment with ID '${id}' not found` }],
      isError: true,
    };
  }

  core.saveMemory(filtered, { force: true });
  notifyMemoryChange();

  return {
    content: [{ type: "text", text: `Forgot fragment with ID: ${id}` }],
  };
}

export async function handleMemoryFeedback(args?: MemoryFeedbackArgs): Promise<ToolResult> {
  const id = args?.id;
  const useful = args?.useful;

  if (!id || typeof id !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'id' parameter is required" }],
      isError: true,
    };
  }
  if (typeof useful !== "boolean") {
    return {
      content: [{ type: "text", text: "Error: 'useful' parameter is required and must be a boolean" }],
      isError: true,
    };
  }

  const memory: any[] = core.loadMemory();
  const targetIndex = memory.findIndex((f: any) => f.id === id);

  if (targetIndex === -1) {
    return {
      content: [{ type: "text", text: `Error: Fragment with ID '${id}' not found` }],
      isError: true,
    };
  }

  if (useful) {
    const boosted = core.boostOnAccess(memory[targetIndex]);
    Object.assign(memory[targetIndex], boosted);
    memory[targetIndex].positive_feedback = (memory[targetIndex].positive_feedback || 0) + 1;
    core.saveMemory(memory);
    notifyMemoryChange();
    return {
      content: [{ type: "text", text: `Positive feedback recorded for [${id}]. Confidence boosted to ${memory[targetIndex].confidence.toFixed(2)}.` }],
    };
  } else {
    const penalized = core.recordNegativeHit(memory[targetIndex]);
    Object.assign(memory[targetIndex], penalized);
    memory[targetIndex].negative_feedback = (memory[targetIndex].negative_feedback || 0) + 1;
    core.saveMemory(memory);
    notifyMemoryChange();
    return {
      content: [{ type: "text", text: `Negative feedback recorded for [${id}]. Confidence reduced to ${memory[targetIndex].confidence.toFixed(2)}.` }],
    };
  }
}

export async function handleMemoryMerge(args?: MemoryMergeArgs): Promise<ToolResult> {
  const ids = args?.ids;
  const title = args?.title;
  const fragment = args?.fragment;
  const project = args?.project === undefined ? null : args.project;

  if (!ids || !Array.isArray(ids) || ids.length < 2) {
    return {
      content: [{ type: "text", text: "Error: 'ids' must be an array with at least 2 fragment IDs" }],
      isError: true,
    };
  }

  if (!title || typeof title !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'title' is required and must be a string" }],
      isError: true,
    };
  }

  if (!fragment || typeof fragment !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'fragment' is required and must be a string" }],
      isError: true,
    };
  }

  const memory: any[] = core.loadMemory();

  const notFound = ids.filter((id: string) => !(memory as any[]).find((f: any) => f.id === id));
  if (notFound.length > 0) {
    return {
      content: [{ type: "text", text: `Error: Fragment(s) not found: ${notFound.join(", ")}` }],
      isError: true,
    };
  }

  const newFragment = core.createFragment(fragment, "ai" as const, title, project);
  memory.push(newFragment);

  const mergedMemory = memory.filter((f: any) => !ids.includes(f.id));
  core.saveMemory(mergedMemory);
  notifyMemoryChange();

  const scopeInfo = newFragment.project ? ` (project: ${newFragment.project})` : " (global)";
  return {
    content: [{ type: "text", text: `Merged ${ids.length} fragments into [${newFragment.id}]${scopeInfo}: "${newFragment.title}"\nRemoved IDs: ${ids.join(", ")}` }],
  };
}

export async function handleGuideGet(args?: GuideGetArgs): Promise<ToolResult> {
  const category = args?.category || null;
  const guideName = args?.guide || null;
  const task = args?.task || null;
  const allGuides = guides.loadGuides();

  if (task) {
    const result = guides.suggestGuides(task, allGuides);
    const formatted = guides.formatSuggestions(result);
    return {
      content: [{ type: "text", text: formatted }],
    };
  }

  if (guideName) {
    const guide = guides.findGuide(allGuides, guideName);
    return {
      content: [{ type: "text", text: guides.formatGuideDetail(guide) }],
    };
  }

  const filtered = category
    ? guides.getGuidesByCategory(allGuides, category)
    : allGuides;

  const formatted = guides.formatGuidesForLLM(filtered);
  return {
    content: [{ type: "text", text: formatted }],
  };
}

export async function handleGuidePractice(args?: GuidePracticeArgs): Promise<ToolResult> {
  const guideName = args?.guide;
  const category = args?.category;
  const description = args?.description || "";
  const contexts = args?.contexts || [];
  const learnings = args?.learnings || [];

  if (!guideName || !category) {
    return {
      content: [{ type: "text", text: "Error: 'guide' and 'category' parameters are required" }],
      isError: true,
    };
  }

  const allGuides = guides.loadGuides();
  const updated = guides.practiceGuide(allGuides, guideName, category, description, contexts, learnings, args?.outcome);

  if (activeSessionId) {
    const allSessions = sessions.loadSessions();
    const session = sessions.findSession(allSessions, activeSessionId);
    if (session) {
      if (!session.guides_used) session.guides_used = [];
      if (!session.guides_used.includes(guideName.toLowerCase())) {
        session.guides_used.push(guideName.toLowerCase());
      }
      sessions.saveSessions(allSessions);
    }
  }

  guides.saveGuides(allGuides);

  const isNew = updated.usage_count === 1;
  const action = isNew ? "Created" : "Updated";
  const response = `${action} guide "${updated.guide}" (${updated.category}): ${updated.usage_count}x usage, ${updated.learnings.length} learnings, ${updated.contexts.length} contexts`;

  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleGuideCreate(args?: GuideCreateArgs): Promise<ToolResult> {
  const guideName = args?.guide;
  const category = args?.category;
  const description = args?.description;
  const contexts = args?.contexts || [];
  const learnings = args?.learnings || [];

  if (!guideName || !category || !description) {
    return {
      content: [{ type: "text", text: "Error: 'guide', 'category', and 'description' parameters are required" }],
      isError: true,
    };
  }

  const allGuides = guides.loadGuides();
  const existing = guides.findSimilarGuide(allGuides, guideName);

  if (existing) {
    existing.description = description;
    guides.saveGuides(allGuides);
    return {
      content: [{ type: "text", text: `Updated manual for existing guide "${existing.guide}" (${existing.category})` }],
    };
  }

  const newGuide = guides.createGuide(guideName, category, description, contexts, learnings);
  allGuides.push(newGuide);
  guides.saveGuides(allGuides);

  return {
    content: [{ type: "text", text: `Created new guide "${newGuide.guide}" (${newGuide.category}) with a detailed manual.` }],
  };
}

export async function handleGuideDistill(args?: GuideDistillArgs): Promise<ToolResult> {
  const memoryId = args?.memory_id;
  const guideName = args?.guide;
  const category = args?.category || "dev-tool";

  if (!memoryId || !guideName) {
    return {
      content: [{ type: "text", text: "Error: 'memory_id' and 'guide' parameters are required" }],
      isError: true,
    };
  }

  const allMemory: any[] = core.loadMemory();
  const fragment = allMemory.find((m: any) => m.id === memoryId);

  if (!fragment) {
    return {
      content: [{ type: "text", text: `Error: Memory fragment with ID '${memoryId}' not found.` }],
      isError: true,
    };
  }

  const allGuides = guides.loadGuides();
  const updated = guides.promoteToGuide(
    allGuides,
    guideName,
    category,
    fragment.fragment,
    fragment.project || "global"
  );

  guides.saveGuides(allGuides);

  let response = `Successfully distilled memory [${memoryId}] into guide "${updated.guide}" (${updated.category}).\n\n`;
  response += guides.formatGuideDetail(updated);

  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleGuideUpdate(args?: GuideUpdateArgs): Promise<ToolResult> {
  const guideName = args?.guide;
  const updates: Record<string, unknown> = {
    guide: args?.new_name,
    category: args?.category,
    description: args?.description,
    add_anti_patterns: args?.add_anti_patterns,
    add_pitfalls: args?.add_pitfalls,
    superseded_by: args?.superseded_by,
    deprecated: args?.deprecated,
  };

  if (!guideName) {
    return {
      content: [{ type: "text", text: "Error: 'guide' parameter is required" }],
      isError: true,
    };
  }

  const allGuides = guides.loadGuides();
  const updated = guides.updateGuide(allGuides, guideName, updates);

  if (!updated) {
    return {
      content: [{ type: "text", text: `Error: Guide "${guideName}" not found.` }],
      isError: true,
    };
  }

  guides.saveGuides(allGuides);
  return {
    content: [{ type: "text", text: `Updated guide "${updated.guide}":\n${guides.formatGuideDetail(updated)}` }],
  };
}

export async function handleGuideForget(args?: GuideForgetArgs): Promise<ToolResult> {
  const guideName = args?.guide;

  if (!guideName) {
    return {
      content: [{ type: "text", text: "Error: 'guide' parameter is required" }],
      isError: true,
    };
  }

  const allGuides = guides.loadGuides();
  const success = guides.deleteGuide(allGuides, guideName);

  if (!success) {
    return {
      content: [{ type: "text", text: `Error: Guide "${guideName}" not found.` }],
      isError: true,
    };
  }

  guides.saveGuides(allGuides, { force: true });
  return {
    content: [{ type: "text", text: `Successfully forgot guide: ${guideName}` }],
  };
}

export async function handleGuideMerge(args?: GuideMergeArgs): Promise<ToolResult> {
  const guideNames = args?.guides;
  const newGuideName = args?.guide;
  const category = args?.category;
  const description = args?.description || "";
  let contexts: string[] | undefined = args?.contexts;
  let learnings: string[] | undefined = args?.learnings;

  if (!guideNames || !Array.isArray(guideNames) || guideNames.length < 2) {
    return {
      content: [{ type: "text", text: "Error: 'guides' must be an array with at least 2 guide names" }],
      isError: true,
    };
  }

  if (!newGuideName || !category) {
    return {
      content: [{ type: "text", text: "Error: 'guide' and 'category' parameters are required" }],
      isError: true,
    };
  }

  const allGuides: any[] = guides.loadGuides();

  const sourceGuides: any[] = [];
  const notFound: string[] = [];
  for (const name of guideNames) {
    const g = guides.findGuide(allGuides, name);
    if (g) {
      sourceGuides.push(g);
    } else {
      notFound.push(name);
    }
  }

  if (notFound.length > 0) {
    return {
      content: [{ type: "text", text: `Error: Guide(s) not found: ${notFound.join(", ")}` }],
      isError: true,
    };
  }

  if (!contexts) {
    contexts = [...new Set(sourceGuides.flatMap((g: any) => g.contexts))];
  }
  if (!learnings) {
    learnings = [...new Set(sourceGuides.flatMap((g: any) => g.learnings))];
  }

  const antiPatterns = [...new Set(sourceGuides.flatMap((g: any) => g.anti_patterns || []))];
  const pitfalls = [...new Set(sourceGuides.flatMap((g: any) => g.known_pitfalls || []))];

  const totalUsage = sourceGuides.reduce((sum: number, g: any) => sum + g.usage_count, 0);

  const newGuide = guides.createGuide(newGuideName, category, description, contexts, learnings);
  newGuide.usage_count = totalUsage;
  newGuide.anti_patterns = antiPatterns;
  newGuide.known_pitfalls = pitfalls;
  allGuides.push(newGuide);

  const mergedGuides = allGuides.filter((g: any) => !guideNames.map((n: string) => n.toLowerCase()).includes(g.guide));
  guides.saveGuides(mergedGuides);

  let response = `Merged ${guideNames.length} guides into "${newGuide.guide}" (${newGuide.category})\n`;
  response += `Total usage: ${totalUsage}x | Contexts: ${contexts.length} | Learnings: ${learnings.length}\n`;
  response += `Removed: ${guideNames.join(", ")}`;

  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleMemoryStats(args?: MemoryStatsArgs): Promise<ToolResult> {
  const project = args?.project || null;
  const memory = core.loadMemory();
  const stats = core.calculateStats(memory, project);
  return {
    content: [{ type: "text", text: core.formatStats(stats) }],
  };
}

export async function handleMemoryAudit(_args?: Record<string, unknown>): Promise<ToolResult> {
  const memory = core.loadMemory();
  const result = core.auditMemory(memory);
  return {
    content: [{ type: "text", text: core.formatAuditReport(result) }],
  };
}

export async function handleSessionStats(args?: SessionStatsArgs): Promise<ToolResult> {
  const count = args?.count || 10;
  const recentSessions = virtualSession.getRecentSessions(count);
  const current = virtualSession.getCurrentVirtualSession();

  let output = `## Session Stats\n`;

  if (current) {
    output += `Active session: ${current.tool_calls.length} tool calls\n`;
    if (current.technologies_seen.size > 0) {
      output += `Technologies: ${[...current.technologies_seen].join(", ")}\n`;
    }
    if (current.guides_used.size > 0) {
      output += `Guides used: ${[...current.guides_used].join(", ")}\n`;
    }
    output += `\n`;
  }

  if (recentSessions.length > 0) {
    output += `Recent sessions (${recentSessions.length}):\n`;
    for (const s of recentSessions.slice(0, 5)) {
      const techs = s.technologies?.length > 0 ? ` [${s.technologies.join(", ")}]` : "";
      output += `  ${s.id}: ${s.duration_tool_calls} calls${techs}\n`;
    }
  } else {
    output += `No past sessions recorded yet.\n`;
  }

  return { content: [{ type: "text", text: output }] };
}

export async function handleWikiSetup(args?: WikiSetupArgs): Promise<ToolResult> {
  const vaultPath = args?.vault_path;
  const projectName = args?.project_name || path.basename(vaultPath || "wiki");
  const language = args?.language || "Türkçe";

  try {
    validateVaultPath(vaultPath || "");

    if (wiki.detectVault(vaultPath!)) {
      const stats = wiki.getVaultStats(vaultPath);
      return {
        content: [{ type: "text", text: `Wiki vault already exists at ${vaultPath}\nStats: ${JSON.stringify(stats, null, 2)}` }],
      };
    }

    const result = wiki.setupVault(vaultPath, projectName, language);
    return {
      content: [{ type: "text", text: `Wiki vault created at ${vaultPath}\nProject: ${projectName}\nLanguage: ${language}\nFolders created: ${result.folders}\nFiles created: ${result.files}` }],
    };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
  }
}

export async function handleWikiIngest(args?: WikiIngestArgs): Promise<ToolResult> {
  const vaultPath = args?.vault_path;
  const filePath = args?.file_path || null;
  const title = args?.title || null;
  const summary = args?.summary;
  const entities = args?.entities || [];
  const concepts = args?.concepts || [];
  const decisions = args?.decisions || [];

  try {
    validateVaultPath(vaultPath || "");

    if (!summary) {
      return { content: [{ type: "text", text: "Error: 'summary' is required — provide a summary of the source content" }], isError: true };
    }

    if (!wiki.detectVault(vaultPath!)) {
      return { content: [{ type: "text", text: `Error: No wiki vault found at ${vaultPath}. Run wiki_setup first.` }], isError: true };
    }

    const date = new Date().toISOString().split("T")[0];
    const slug = (title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const sourcePage = path.join(vaultPath, "sources", `${date}-${slug}.md`);

    let pageContent = `---\ntitle: ${title || "Untitled"}\ntags: [source]\nsource: ${filePath || "manual"}\ndate: ${date}\nstatus: active\n---\n\n# ${title || "Untitled"}\n\n${summary}\n\n## Sources\n\n${filePath ? `- ${path.basename(filePath)}` : "- Manual entry"}\n\n## Related\n`;

    wiki.writePage(sourcePage, pageContent);

    let pagesCreated = 1;
    const createdPages: string[] = [`sources/${date}-${slug}.md`];

    for (const entity of entities) {
      const entitySlug = entity.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const entityPath = path.join(vaultPath, "entities", `${entitySlug}.md`);
      if (!fs.existsSync(entityPath)) {
        const entityContent = `---\ntitle: ${entity}\ntags: [entity]\ndate: ${date}\nstatus: active\n---\n\n# ${entity}\n\n## Sources\n\n- [[${date}-${slug}]]\n\n## Related\n`;
        wiki.writePage(entityPath, entityContent);
        pagesCreated++;
        createdPages.push(`entities/${entitySlug}.md`);
      } else {
        const existing = wiki.readPage(entityPath) || "";
        if (!existing.includes(`[[${date}-${slug}]]`)) {
          const updated = existing.replace("## Related", `## Related\n\n- [[${date}-${slug}]]`);
          wiki.writePage(entityPath, updated);
        }
      }
    }

    for (const concept of concepts) {
      const conceptSlug = concept.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const conceptPath = path.join(vaultPath, "concepts", `${conceptSlug}.md`);
      if (!fs.existsSync(conceptPath)) {
        const conceptContent = `---\ntitle: ${concept}\ntags: [concept]\ndate: ${date}\nstatus: active\n---\n\n# ${concept}\n\n## Sources\n\n- [[${date}-${slug}]]\n\n## Related\n`;
        wiki.writePage(conceptPath, conceptContent);
        pagesCreated++;
        createdPages.push(`concepts/${conceptSlug}.md`);
      }
    }

    for (const decision of decisions) {
      const decisionSlug = decision.toLowerCase().substring(0, 60).replace(/[^a-z0-9]+/g, "-");
      const decisionPath = path.join(vaultPath, "decisions", `${date}-${decisionSlug}.md`);
      const decisionContent = `---\ntitle: ${decision}\ntags: [decision]\ndate: ${date}\nstatus: active\n---\n\n# ${decision}\n\n## Sources\n\n- [[${date}-${slug}]]\n\n## Related\n`;
      wiki.writePage(decisionPath, decisionContent);
      pagesCreated++;
      createdPages.push(`decisions/${date}-${decisionSlug}.md`);
    }

    wiki.updateIndex(vaultPath, "Kaynaklar (Sources)", title || "Untitled", sourcePage);
    wiki.appendToLog(vaultPath, `## [${date}] ingest | ${title || "Untitled"}\n  file: ${filePath || "manual"}\n  created: ${createdPages.join(", ")}`);

    return {
      content: [{ type: "text", text: `Ingested: ${title || "Untitled"}\nPages created: ${pagesCreated}\nFiles:\n${createdPages.map((p) => `  - ${p}`).join("\n")}\nEntities: ${entities.length} | Concepts: ${concepts.length} | Decisions: ${decisions.length}` }],
    };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
  }
}

export async function handleWikiQuery(args?: WikiQueryArgs): Promise<ToolResult> {
  const vaultPath = args?.vault_path;
  const query = args?.query;

  try {
    validateVaultPath(vaultPath || "");

    if (!query) {
      return { content: [{ type: "text", text: "Error: 'query' is required" }], isError: true };
    }

    if (!wiki.detectVault(vaultPath!)) {
      return { content: [{ type: "text", text: `Error: No wiki vault found at ${vaultPath}. Run wiki_setup first.` }], isError: true };
    }

    const results = wiki.searchWiki(vaultPath, query);

    if (results.length === 0) {
      const date = new Date().toISOString().split("T")[0];
      wiki.appendToLog(vaultPath, `## [${date}] query | "${query}" → no results`);
      return {
        content: [{ type: "text", text: `No results found for: "${query}"\n\nConsider adding more sources to the wiki via wiki_ingest.` }],
      };
    }

    let response = `Found ${results.length} matching page(s) for: "${query}"\n\n`;

    for (const result of results) {
      response += `### ${result.title}\nFile: ${result.file}\n`;
      for (const match of result.matches) {
        response += `  > ${match}\n`;
      }
      response += "\n";
    }

    const date = new Date().toISOString().split("T")[0];
    wiki.appendToLog(vaultPath, `## [${date}] query | "${query}" → ${results.length} results`);

    return { content: [{ type: "text", text: response }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
  }
}

export async function handleWikiLint(args?: WikiLintArgs): Promise<ToolResult> {
  const vaultPath = args?.vault_path;

  try {
    validateVaultPath(vaultPath || "");

    if (!wiki.detectVault(vaultPath!)) {
      return { content: [{ type: "text", text: `Error: No wiki vault found at ${vaultPath}. Run wiki_setup first.` }], isError: true };
    }

    const findings = wiki.lintWiki(vaultPath);
    const stats = wiki.getVaultStats(vaultPath);

    const date = new Date().toISOString().split("T")[0];
    const high = findings.filter((f) => f.priority === "high").length;
    const medium = findings.filter((f) => f.priority === "medium").length;
    const low = findings.filter((f) => f.priority === "low").length;

    let report = `# Wiki Lint Report — ${date}\n\n`;
    report += `Vault: ${vaultPath}\n`;
    report += `Total pages: ${stats.total} | Raw sources: ${stats.raw}\n`;
    report += `Findings: ${findings.length} (H:${high} M:${medium} L:${low})\n\n`;

    if (findings.length === 0) {
      report += "No issues found. Wiki is healthy.\n";
    } else {
      for (const finding of findings) {
        report += `- [${finding.priority.toUpperCase()}] ${finding.category}: ${finding.file}\n  ${finding.description}\n  Fix: ${finding.suggestion}\n\n`;
      }
    }

    const lintReportPath = path.join(vaultPath, "lint-report.md");
    wiki.writePage(lintReportPath, report);
    wiki.appendToLog(vaultPath, `## [${date}] lint | ${findings.length} findings (H:${high} M:${medium} L:${low})`);

    return { content: [{ type: "text", text: report }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
  }
}

export async function handleCallTool(request: ToolCallRequest): Promise<ToolResult> {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "session_start":
        return await handleSessionStart(args as SessionStartArgs);
      case "session_end":
        return await handleSessionEnd(args as SessionEndArgs);
      case "memory_read":
        return await handleMemoryRead(args as MemoryReadArgs);
      case "memory_add":
        return await handleMemoryAdd(args as MemoryAddArgs);
      case "memory_update":
        return await handleMemoryUpdate(args as MemoryUpdateArgs);
      case "memory_forget":
        return await handleMemoryForget(args as MemoryForgetArgs);
      case "memory_feedback":
        return await handleMemoryFeedback(args as MemoryFeedbackArgs);
      case "memory_merge":
        return await handleMemoryMerge(args as MemoryMergeArgs);
      case "memory_stats":
        return await handleMemoryStats(args as MemoryStatsArgs);
      case "memory_audit":
        return await handleMemoryAudit(args);
      case "guide_get":
        return await handleGuideGet(args as GuideGetArgs);
      case "guide_practice":
        return await handleGuidePractice(args as GuidePracticeArgs);
      case "guide_create":
        return await handleGuideCreate(args as GuideCreateArgs);
      case "guide_distill":
        return await handleGuideDistill(args as GuideDistillArgs);
      case "guide_update":
        return await handleGuideUpdate(args as GuideUpdateArgs);
      case "guide_forget":
        return await handleGuideForget(args as GuideForgetArgs);
      case "guide_merge":
        return await handleGuideMerge(args as GuideMergeArgs);
      case "session_stats":
        return await handleSessionStats(args as SessionStatsArgs);
      case "wiki_setup":
        return await handleWikiSetup(args as WikiSetupArgs);
      case "wiki_ingest":
        return await handleWikiIngest(args as WikiIngestArgs);
      case "wiki_query":
        return await handleWikiQuery(args as WikiQueryArgs);
      case "wiki_lint":
        return await handleWikiLint(args as WikiLintArgs);
      default:
        return {
          content: [{ type: "text", text: `Error: Unknown tool '${name}'` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
