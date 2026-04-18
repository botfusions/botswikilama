// Tool handler functions for MCP server
import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";
import * as sessions from "../sessions/index.js";

let activeSessionId = null;

export async function handleSessionStart(args) {
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

export async function handleSessionEnd(args) {
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
  const improvementLines = [];

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

/**
 * Handle memory_read tool (unified: read, list, search)
 */
export async function handleMemoryRead(args) {
  const currentProject = args?.project || core.detectProject();
  const query = args?.query || null;
  const detailId = args?.id || null;
  const context = args?.context || null;
  const showAll = args?.all === true;

  let memory = core.loadMemory();

  const detailIds = args?.ids || null;
  if (detailIds && Array.isArray(detailIds) && detailIds.length > 0) {
    const results = [];
    for (const did of detailIds) {
      const fragment = memory.find(f => f.id === did);
      if (fragment) {
        const boosted = core.boostOnAccess(fragment, context);
        Object.assign(fragment, boosted);
        results.push(core.formatMemoryDetail(fragment));
      } else {
        results.push(`Fragment [${did}] not found.`);
      }
    }
    core.saveMemory(memory);
    return {
      content: [{ type: "text", text: results.join("\n\n") }],
    };
  }

  if (detailId) {
    const fragment = memory.find(f => f.id === detailId);
    if (!fragment) {
      return {
        content: [{ type: "text", text: `Error: Fragment with ID '${detailId}' not found` }],
        isError: true,
      };
    }
    // Update access with confidence boost and context tagging
    const boosted = core.boostOnAccess(fragment, context);
    Object.assign(fragment, boosted);
    core.saveMemory(memory);

    return {
      content: [{ type: "text", text: core.formatMemoryDetail(fragment) }],
    };
  }

  // Filter by project (or show all if all=true)
  const filteredMemory = showAll
    ? memory
    : core.filterByProject(memory, currentProject);

  // Execute Search and Top-K Truncation on filtered set
  const results = core.searchAndSortFragments(filteredMemory, query, 30);

  // Boost accessed fragments in the full memory array
  const resultIds = new Set(results.map(r => r.id));
  for (const frag of memory) {
    if (resultIds.has(frag.id)) {
      const boosted = core.boostOnAccess(frag, context);
      Object.assign(frag, boosted);
    }
  }

  const scopeInfo = showAll ? "all projects" : currentProject || "global";
  const formatted = core.formatMemoryForLLM(results, scopeInfo);
  core.saveMemory(memory);
  return {
    content: [{ type: "text", text: formatted }],
  };
}

/**
 * Handle memory_add tool
 */
export async function handleMemoryAdd(args) {
  const fragment = args?.fragment;
  const title = args?.title || null;
  const description = args?.description || null;
  const project = args?.project === undefined ? null : args.project;
  const source = args?.source || "ai";

  if (!fragment || typeof fragment !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'fragment' parameter is required and must be a string" }],
      isError: true,
    };
  }

  const memory = core.loadMemory();

  // --- Duplication Prevention Feature ---
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

  const scopeInfo = newFragment.project ? ` (project: ${newFragment.project})` : " (global)";
  return {
    content: [{ type: "text", text: `Added fragment [${newFragment.id}]${scopeInfo}: "${newFragment.title}"\nSummary: ${newFragment.description}` }],
  };
}

/**
 * Handle memory_update tool
 */
export async function handleMemoryUpdate(args) {
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

  const memory = core.loadMemory();
  const targetIndex = memory.findIndex((f) => f.id === id);

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

  return {
    content: [{ type: "text", text: `Updated fragment [${id}]: "${memory[targetIndex].title}"` }],
  };
}

/**
 * Handle memory_forget tool
 */
export async function handleMemoryForget(args) {
  const id = args?.id;

  if (!id || typeof id !== "string") {
    return {
      content: [{ type: "text", text: "Error: 'id' parameter is required and must be a string" }],
      isError: true,
    };
  }

  const memory = core.loadMemory();
  const initialLength = memory.length;
  const filtered = memory.filter((f) => f.id !== id);

  if (filtered.length === initialLength) {
    return {
      content: [{ type: "text", text: `Error: Fragment with ID '${id}' not found` }],
      isError: true,
    };
  }

  core.saveMemory(filtered, { force: true });

  return {
    content: [{ type: "text", text: `Forgot fragment with ID: ${id}` }],
  };
}

/**
 * Handle memory_feedback tool
 */
export async function handleMemoryFeedback(args) {
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

  const memory = core.loadMemory();
  const targetIndex = memory.findIndex((f) => f.id === id);

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
    return {
      content: [{ type: "text", text: `Positive feedback recorded for [${id}]. Confidence boosted to ${memory[targetIndex].confidence.toFixed(2)}.` }],
    };
  } else {
    const penalized = core.recordNegativeHit(memory[targetIndex]);
    Object.assign(memory[targetIndex], penalized);
    memory[targetIndex].negative_feedback = (memory[targetIndex].negative_feedback || 0) + 1;
    core.saveMemory(memory);
    return {
      content: [{ type: "text", text: `Negative feedback recorded for [${id}]. Confidence reduced to ${memory[targetIndex].confidence.toFixed(2)}.` }],
    };
  }
}

/**
 * Handle memory_merge tool
 */
export async function handleMemoryMerge(args) {
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

  const memory = core.loadMemory();

  // Verify all IDs exist
  const notFound = ids.filter(id => !memory.find(f => f.id === id));
  if (notFound.length > 0) {
    return {
      content: [{ type: "text", text: `Error: Fragment(s) not found: ${notFound.join(", ")}` }],
      isError: true,
    };
  }

  // Create new merged fragment
  const newFragment = core.createFragment(fragment, "ai", title, project);
  memory.push(newFragment);

  // Remove old fragments
  const mergedMemory = memory.filter(f => !ids.includes(f.id));
  core.saveMemory(mergedMemory);

  const scopeInfo = newFragment.project ? ` (project: ${newFragment.project})` : " (global)";
  return {
    content: [{ type: "text", text: `Merged ${ids.length} fragments into [${newFragment.id}]${scopeInfo}: "${newFragment.title}"\nRemoved IDs: ${ids.join(", ")}` }],
  };
}

/**
 * Handle guide_get tool (unified: get, list, suggest)
 */
export async function handleGuideGet(args) {
  const category = args?.category || null;
  const guideName = args?.guide || null;
  const task = args?.task || null;
  const allGuides = guides.loadGuides();

  // If task provided, return suggestions based on task
  if (task) {
    const result = guides.suggestGuides(task, allGuides);
    const formatted = guides.formatSuggestions(result);
    return {
      content: [{ type: "text", text: formatted }],
    };
  }

  // Get specific guide detail
  if (guideName) {
    const guide = guides.findGuide(allGuides, guideName);
    return {
      content: [{ type: "text", text: guides.formatGuideDetail(guide) }],
    };
  }

  // Filter by category or get all
  const filtered = category
    ? guides.getGuidesByCategory(allGuides, category)
    : allGuides;

  const formatted = guides.formatGuidesForLLM(filtered);
  return {
    content: [{ type: "text", text: formatted }],
  };
}

/**
 * Handle guide_practice tool
 */
export async function handleGuidePractice(args) {
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

/**
 * Handle guide_create tool
 */
export async function handleGuideCreate(args) {
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

/**
 * Handle guide_distill tool
 */
export async function handleGuideDistill(args) {
  const memoryId = args?.memory_id;
  const guideName = args?.guide;
  const category = args?.category || "dev-tool";

  if (!memoryId || !guideName) {
    return {
      content: [{ type: "text", text: "Error: 'memory_id' and 'guide' parameters are required" }],
      isError: true,
    };
  }

  const allMemory = core.loadMemory();
  const fragment = allMemory.find(m => m.id === memoryId);

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

/**
 * Handle guide_update tool
 */
export async function handleGuideUpdate(args) {
  const guideName = args?.guide;
  const updates = {
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

/**
 * Handle guide_forget tool
 */
export async function handleGuideForget(args) {
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

/**
 * Handle guide_merge tool
 */
export async function handleGuideMerge(args) {
  const guideNames = args?.guides;
  const newGuideName = args?.guide;
  const category = args?.category;
  const description = args?.description || "";
  let contexts = args?.contexts;
  let learnings = args?.learnings;

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

  const allGuides = guides.loadGuides();

  // Find all source guides
  const sourceGuides = [];
  const notFound = [];
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

  // Auto-merge contexts and learnings if not provided
  if (!contexts) {
    contexts = [...new Set(sourceGuides.flatMap(g => g.contexts))];
  }
  if (!learnings) {
    learnings = [...new Set(sourceGuides.flatMap(g => g.learnings))];
  }

  const antiPatterns = [...new Set(sourceGuides.flatMap(g => g.anti_patterns || []))];
  const pitfalls = [...new Set(sourceGuides.flatMap(g => g.known_pitfalls || []))];

  const totalUsage = sourceGuides.reduce((sum, g) => sum + g.usage_count, 0);

  const newGuide = guides.createGuide(newGuideName, category, description, contexts, learnings);
  newGuide.usage_count = totalUsage;
  newGuide.anti_patterns = antiPatterns;
  newGuide.known_pitfalls = pitfalls;
  allGuides.push(newGuide);

  // Remove old guides
  const mergedGuides = allGuides.filter(g => !guideNames.map(n => n.toLowerCase()).includes(g.guide));
  guides.saveGuides(mergedGuides);

  let response = `Merged ${guideNames.length} guides into "${newGuide.guide}" (${newGuide.category})\n`;
  response += `Total usage: ${totalUsage}x | Contexts: ${contexts.length} | Learnings: ${learnings.length}\n`;
  response += `Removed: ${guideNames.join(", ")}`;

  return {
    content: [{ type: "text", text: response }],
  };
}

/**
 * Main call tool handler - dispatches to appropriate handler
 */
export async function handleMemoryStats(args) {
  const project = args?.project || null;
  const memory = core.loadMemory();
  const stats = core.calculateStats(memory, project);
  return {
    content: [{ type: "text", text: core.formatStats(stats) }],
  };
}

export async function handleMemoryAudit(args) {
  const memory = core.loadMemory();
  const result = core.auditMemory(memory);
  return {
    content: [{ type: "text", text: core.formatAuditReport(result) }],
  };
}

export async function handleCallTool(request) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "session_start":
        return await handleSessionStart(args);
      case "session_end":
        return await handleSessionEnd(args);
      case "memory_read":
        return await handleMemoryRead(args);
      case "memory_add":
        return await handleMemoryAdd(args);
      case "memory_update":
        return await handleMemoryUpdate(args);
      case "memory_forget":
        return await handleMemoryForget(args);
      case "memory_feedback":
        return await handleMemoryFeedback(args);
      case "memory_merge":
        return await handleMemoryMerge(args);
      case "memory_stats":
        return await handleMemoryStats(args);
      case "memory_audit":
        return await handleMemoryAudit(args);
      case "guide_get":
        return await handleGuideGet(args);
      case "guide_practice":
        return await handleGuidePractice(args);
      case "guide_create":
        return await handleGuideCreate(args);
      case "guide_distill":
        return await handleGuideDistill(args);
      case "guide_update":
        return await handleGuideUpdate(args);
      case "guide_forget":
        return await handleGuideForget(args);
      case "guide_merge":
        return await handleGuideMerge(args);
      default:
        return {
          content: [{ type: "text", text: `Error: Unknown tool '${name}'` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}
