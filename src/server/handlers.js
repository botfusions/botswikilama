// Tool handler functions for MCP server
import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";

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
  memory = core.decayConfidence(memory);

  // If specific ID requested, return full detail
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
  if (similarMatch && source === "ai") {
    return {
      content: [{
        type: "text",
        text: `Error: A highly similar memory already exists. Please use the 'memory_update' tool on ID [${similarMatch.id}] instead of adding a new one.\nExisting Memory Title: "${similarMatch.title}"\nExisting Content: "${similarMatch.fragment}"`
      }],
      isError: true,
    };
  }

  const newFragment = core.createFragment(fragment, source, title, project, description);
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
    core.saveMemory(memory);
    return {
      content: [{ type: "text", text: `Positive feedback recorded for [${id}]. Confidence boosted to ${memory[targetIndex].confidence.toFixed(2)}.` }],
    };
  } else {
    const penalized = core.recordNegativeHit(memory[targetIndex]);
    Object.assign(memory[targetIndex], penalized);
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
  const updated = guides.practiceGuide(allGuides, guideName, category, description, contexts, learnings);
  guides.saveGuides(allGuides);

  const isNew = updated.usage_count === 1;
  const action = isNew ? "Created" : "Updated";

  let response = `${action} guide "${updated.guide}" (${updated.category}): ${updated.usage_count}x usage\n\n`;
  response += guides.formatGuideDetail(updated);

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
  const existing = guides.findGuide(allGuides, guideName);

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
    description: args?.description
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

  // Sum usage counts
  const totalUsage = sourceGuides.reduce((sum, g) => sum + g.usage_count, 0);

  // Create new merged guide
  const newGuide = guides.createGuide(newGuideName, category, description, contexts, learnings);
  newGuide.usage_count = totalUsage;
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
export async function handleCallTool(request) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
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
