// Tool handler functions for MCP server
import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";

/**
 * Handle memory_read tool
 */
export async function handleMemoryRead(args) {
  const currentProject = args?.project || core.detectProject();
  const query = args?.query || null;
  const detailId = args?.id || null; // Optional: get full detail for specific ID

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
    // Update access
    fragment.accessed++;
    fragment.lastAccessed = new Date().toISOString();
    core.saveMemory(memory);

    return {
      content: [{ type: "text", text: core.formatMemoryDetail(fragment) }],
    };
  }

  // Normal mode: filtered summary view
  memory = core.filterByProject(memory, currentProject);

  // Execute Search and Top-K Truncation
  memory = core.searchAndSortFragments(memory, query, 30);

  const formatted = core.formatMemoryForLLM(memory, currentProject);
  core.saveMemory(core.loadMemory()); // Save decayed full memory
  return {
    content: [{ type: "text", text: formatted }],
  };
}

/**
 * Handle memory_check tool
 */
export async function handleMemoryCheck(args) {
  const project = args?.project || core.detectProject();
  const memory = core.loadMemory();
  const filtered = core.filterByProject(memory, project);

  if (filtered.length === 0) {
    return {
      content: [{ type: "text", text: `No memory found for: ${project}\nProceed with analysis and save findings.` }],
    };
  }

  const summary = filtered.map(f => `[${f.id}] ${f.title}`).join("\n");
  return {
    content: [{ type: "text", text: `Found ${filtered.length} fragments for "${project}":\n${summary}\n\nYou already have context. Ask user if they want re-analysis or summary.` }],
  };
}

/**
 * Handle memory_add tool
 */
export async function handleMemoryAdd(args) {
  const fragment = args?.fragment;
  const title = args?.title || null;
  const description = args?.description || null;
  // null = global, undefined = auto-detect, string = project-specific
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

  core.saveMemory(filtered);

  return {
    content: [{ type: "text", text: `Forgot fragment with ID: ${id}` }],
  };
}

/**
 * Handle memory_list tool
 */
export async function handleMemoryList(args) {
  const all = args?.all === true;
  const currentProject = core.detectProject();
  let memory = core.loadMemory();

  if (!all) {
    memory = core.filterByProject(memory, currentProject);
  }

  const formatted = JSON.stringify(memory, null, 2);
  const scopeInfo = all ? "(all projects)" : `(project: ${currentProject || "global"})`;
  return {
    content: [{ type: "text", text: `=== MEMORY FRAGMENTS ${scopeInfo} ===\n${formatted}` }],
  };
}

/**
 * Handle guide_get tool
 */
export async function handleGuideGet(args) {
  const category = args?.category || null;
  const guideName = args?.guide || null;
  const allGuides = guides.loadGuides();

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

  // Return guide detail including description/manual so AI can read protocols
  let response = `${action} guide "${updated.guide}" (${updated.category}): ${updated.usage_count}x usage\n\n`;
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

  guides.saveGuides(allGuides);
  return {
    content: [{ type: "text", text: `Successfully forgot guide: ${guideName}` }],
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
 * Handle guide_discover tool
 */
export async function handleGuideDiscover() {
  const fs = await import("fs");
  const path = await import("path");
  const cwd = process.cwd();
  const discovered = [];

  // Check package.json for dependencies
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Map common packages to guides
      const packageToGuide = {
        "react": { guide: "react", category: "web-frontend" },
        "vue": { guide: "vue", category: "web-frontend" },
        "angular": { guide: "angular", category: "web-frontend" },
        "svelte": { guide: "svelte", category: "web-frontend" },
        "next": { guide: "nextjs", category: "web-frontend" },
        "express": { guide: "express", category: "web-backend" },
        "fastify": { guide: "fastify", category: "web-backend" },
        "nestjs": { guide: "nestjs", category: "web-backend" },
        "koa": { guide: "koa", category: "web-backend" },
        "typescript": { guide: "typescript", category: "programming-language" },
        "python": { guide: "python", category: "programming-language" },
        "mongoose": { guide: "mongodb", category: "data-storage" },
        "prisma": { guide: "prisma", category: "data-storage" },
        "sequelize": { guide: "sequelize", category: "data-storage" },
        "tailwindcss": { guide: "tailwind", category: "web-frontend" },
        "jest": { guide: "jest", category: "dev-tool" },
        "vitest": { guide: "vitest", category: "dev-tool" },
        "eslint": { guide: "eslint", category: "dev-tool" },
        "webpack": { guide: "webpack", category: "dev-tool" },
        "vite": { guide: "vite", category: "dev-tool" },
        "docker": { guide: "docker", category: "infra-devops" },
        "@modelcontextprotocol/sdk": { guide: "mcp", category: "dev-tool" },
        "zod": { guide: "zod", category: "dev-tool" },
        "fuse.js": { guide: "fusejs", category: "dev-tool" },
        "axios": { guide: "axios", category: "dev-tool" },
        "lodash": { guide: "lodash", category: "dev-tool" },
        "chalk": { guide: "chalk", category: "dev-tool" },
        "commander": { guide: "commander", category: "dev-tool" },
        "yaml": { guide: "yaml", category: "dev-tool" },
        "dotenv": { guide: "dotenv", category: "dev-tool" },
      };

      for (const [pkgName] of Object.entries(deps)) {
        const mapping = packageToGuide[pkgName];
        if (mapping) {
          discovered.push(mapping);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // --- File-based Discovery Enhancement ---
  try {
    const files = fs.readdirSync(cwd);
    const fileMappings = [
      { pattern: /\.js$/, guide: "javascript", category: "programming-language" },
      { pattern: /\.ts$/, guide: "typescript", category: "programming-language" },
      { pattern: /tsconfig\.json$/, guide: "typescript", category: "programming-language" },
      { pattern: /\.mcp\.json$|claude_desktop_config\.json$/, guide: "mcp", category: "dev-tool" },
    ];

    for (const mapping of fileMappings) {
      if (files.some(f => mapping.pattern.test(f))) {
        // Only add if not already in discovered (to avoid duplicates)
        if (!discovered.some(d => d.guide === mapping.guide)) {
          discovered.push({ guide: mapping.guide, category: mapping.category });
        }
      }
    }
  } catch {
    // Ignore readdir errors
  }

  // Register discovered guides
  const allGuides = guides.loadGuides();
  const registered = [];
  const alreadyTracked = [];

  for (const { guide, category } of discovered) {
    const existing = guides.findGuide(allGuides, guide);
    if (!existing) {
      guides.practiceGuide(allGuides, guide, category, "");
      registered.push(`${guide} (${category})`);
    } else {
      alreadyTracked.push(guide);
    }
  }

  if (registered.length > 0) {
    guides.saveGuides(allGuides);
  }

  // Build response message
  let message = "";
  if (registered.length > 0) {
    message += `✅ Discovered and registered ${registered.length} new guides:\n${registered.join("\n")}`;
  }
  if (alreadyTracked.length > 0) {
    if (message) message += "\n\n";
    message += `📌 Already tracked (${alreadyTracked.length}): ${alreadyTracked.join(", ")}`;
  }
  if (!message) {
    message = "No recognizable packages found in project dependencies.";
  }

  return {
    content: [{ type: "text", text: message }],
  };
}

/**
 * Handle guide_suggest tool
 */
export async function handleGuideSuggest(args) {
  const task = args?.task;

  if (!task) {
    return {
      content: [{ type: "text", text: "Error: 'task' parameter is required" }],
      isError: true,
    };
  }

  const allGuides = guides.loadGuides();
  const result = guides.suggestGuides(task, allGuides);
  const formatted = guides.formatSuggestions(result);

  return {
    content: [{ type: "text", text: formatted }],
  };
}

/**
 * Handle guide_distill tool
 */
export async function handleGuideDistill(args) {
  const memoryId = args?.memory_id;
  const guideName = args?.guide;
  const category = args?.category || "dev-tool"; // Default to dev-tool if not provided

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
 * Main call tool handler - dispatches to appropriate handler
 */
export async function handleCallTool(request) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "memory_read":
        return await handleMemoryRead(args);
      case "memory_check":
        return await handleMemoryCheck(args);
      case "memory_add":
        return await handleMemoryAdd(args);
      case "memory_update":
        return await handleMemoryUpdate(args);
      case "memory_forget":
        return await handleMemoryForget(args);
      case "memory_list":
        return await handleMemoryList(args);
      case "guide_get":
        return await handleGuideGet(args);
      case "guide_practice":
        return await handleGuidePractice(args);
      case "guide_update":
        return await handleGuideUpdate(args);
      case "guide_forget":
        return await handleGuideForget(args);
      case "guide_create":
        return await handleGuideCreate(args);
      case "guide_discover":
        return await handleGuideDiscover();
      case "guide_suggest":
        return await handleGuideSuggest(args);
      case "guide_distill":
        return await handleGuideDistill(args);
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
