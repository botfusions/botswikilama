// Tool handler functions for MCP server
import * as core from "../memory/index.js";
import * as skills from "../skills/index.js";

/**
 * Handle memory_read tool
 */
export async function handleMemoryRead(args) {
  const currentProject = args?.project || core.detectProject();
  const query = args?.query || null;

  let memory = core.loadMemory();
  memory = core.decayConfidence(memory);
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

  const newFragment = core.createFragment(fragment, source, title, project);
  memory.push(newFragment);
  core.saveMemory(memory);

  const scopeInfo = newFragment.project ? ` (project: ${newFragment.project})` : " (global)";
  return {
    content: [{ type: "text", text: `Added fragment [${newFragment.id}]${scopeInfo}: "${newFragment.title}"` }],
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
 * Handle skill_get tool
 */
export async function handleSkillGet(args) {
  const category = args?.category || null;
  const skillName = args?.skill || null;
  const allSkills = skills.loadSkills();

  // Get specific skill detail
  if (skillName) {
    const skill = skills.findSkill(allSkills, skillName);
    return {
      content: [{ type: "text", text: skills.formatSkillDetail(skill) }],
    };
  }

  // Filter by category or get all
  const filtered = category
    ? skills.getSkillsByCategory(allSkills, category)
    : allSkills;

  const formatted = skills.formatSkillsForLLM(filtered);
  return {
    content: [{ type: "text", text: formatted }],
  };
}

/**
 * Handle skill_practice tool
 */
export async function handleSkillPractice(args) {
  const skillName = args?.skill;
  const category = args?.category;
  const description = args?.description || "";
  const contexts = args?.contexts || [];
  const learnings = args?.learnings || [];

  if (!skillName || !category) {
    return {
      content: [{ type: "text", text: "Error: 'skill' and 'category' parameters are required" }],
      isError: true,
    };
  }

  const allSkills = skills.loadSkills();
  const updated = skills.practiceSkill(allSkills, skillName, category, description, contexts, learnings);
  skills.saveSkills(allSkills);

  const isNew = updated.usage_count === 1;
  const action = isNew ? "Created" : "Updated";

  // Return skill detail including description/manual so AI can read protocols
  let response = `${action} skill "${updated.skill}" (${updated.category}): ${updated.usage_count}x usage\n\n`;
  response += skills.formatSkillDetail(updated);

  return {
    content: [{ type: "text", text: response }],
  };
}

/**
 * Handle skill_update tool
 */
export async function handleSkillUpdate(args) {
  const skillName = args?.skill;
  const updates = {
    skill: args?.new_name,
    category: args?.category,
    description: args?.description
  };

  if (!skillName) {
    return {
      content: [{ type: "text", text: "Error: 'skill' parameter is required" }],
      isError: true,
    };
  }

  const allSkills = skills.loadSkills();
  const updated = skills.updateSkill(allSkills, skillName, updates);

  if (!updated) {
    return {
      content: [{ type: "text", text: `Error: Skill "${skillName}" not found.` }],
      isError: true,
    };
  }

  skills.saveSkills(allSkills);
  return {
    content: [{ type: "text", text: `Updated skill "${updated.skill}":\n${skills.formatSkillDetail(updated)}` }],
  };
}

/**
 * Handle skill_forget tool
 */
export async function handleSkillForget(args) {
  const skillName = args?.skill;

  if (!skillName) {
    return {
      content: [{ type: "text", text: "Error: 'skill' parameter is required" }],
      isError: true,
    };
  }

  const allSkills = skills.loadSkills();
  const success = skills.deleteSkill(allSkills, skillName);

  if (!success) {
    return {
      content: [{ type: "text", text: `Error: Skill "${skillName}" not found.` }],
      isError: true,
    };
  }

  skills.saveSkills(allSkills);
  return {
    content: [{ type: "text", text: `Successfully forgot skill: ${skillName}` }],
  };
}

/**
 * Handle skill_create tool
 */
export async function handleSkillCreate(args) {
  const skillName = args?.skill;
  const category = args?.category;
  const description = args?.description;
  const contexts = args?.contexts || [];
  const learnings = args?.learnings || [];

  if (!skillName || !category || !description) {
    return {
      content: [{ type: "text", text: "Error: 'skill', 'category', and 'description' parameters are required" }],
      isError: true,
    };
  }

  const allSkills = skills.loadSkills();
  const existing = skills.findSkill(allSkills, skillName);

  if (existing) {
    existing.description = description;
    skills.saveSkills(allSkills);
    return {
      content: [{ type: "text", text: `Updated manual for existing skill "${existing.skill}" (${existing.category})` }],
    };
  }

  const newSkill = skills.createSkill(skillName, category, description, contexts, learnings);
  allSkills.push(newSkill);
  skills.saveSkills(allSkills);

  return {
    content: [{ type: "text", text: `Created new manager skill "${newSkill.skill}" (${newSkill.category}) with a detailed manual.` }],
  };
}

/**
 * Handle skill_discover tool
 */
export async function handleSkillDiscover() {
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

      // Map common packages to skills
      const packageToSkill = {
        "react": { skill: "react", category: "frontend" },
        "vue": { skill: "vue", category: "frontend" },
        "angular": { skill: "angular", category: "frontend" },
        "svelte": { skill: "svelte", category: "frontend" },
        "next": { skill: "nextjs", category: "frontend" },
        "express": { skill: "express", category: "backend" },
        "fastify": { skill: "fastify", category: "backend" },
        "nestjs": { skill: "nestjs", category: "backend" },
        "koa": { skill: "koa", category: "backend" },
        "typescript": { skill: "typescript", category: "language" },
        "python": { skill: "python", category: "language" },
        "mongoose": { skill: "mongodb", category: "database" },
        "prisma": { skill: "prisma", category: "database" },
        "sequelize": { skill: "sequelize", category: "database" },
        "tailwindcss": { skill: "tailwind", category: "frontend" },
        "jest": { skill: "jest", category: "tool" },
        "vitest": { skill: "vitest", category: "tool" },
        "eslint": { skill: "eslint", category: "tool" },
        "webpack": { skill: "webpack", category: "tool" },
        "vite": { skill: "vite", category: "tool" },
        "docker": { skill: "docker", category: "tool" },
        "@modelcontextprotocol/sdk": { skill: "mcp", category: "tool" },
        "zod": { skill: "zod", category: "tool" },
      };

      for (const [pkgName] of Object.entries(deps)) {
        const mapping = packageToSkill[pkgName];
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
      { pattern: /\.js$/, skill: "javascript", category: "language" },
      { pattern: /\.ts$/, skill: "typescript", category: "language" },
      { pattern: /tsconfig\.json$/, skill: "typescript", category: "language" },
      { pattern: /\.mcp\.json$|claude_desktop_config\.json$/, skill: "mcp", category: "tool" },
    ];

    for (const mapping of fileMappings) {
      if (files.some(f => mapping.pattern.test(f))) {
        // Only add if not already in discovered (to avoid duplicates)
        if (!discovered.some(d => d.skill === mapping.skill)) {
          discovered.push({ skill: mapping.skill, category: mapping.category });
        }
      }
    }
  } catch {
    // Ignore readdir errors
  }

  // Register discovered skills
  const allSkills = skills.loadSkills();
  const registered = [];
  for (const { skill, category } of discovered) {
    const existing = skills.findSkill(allSkills, skill);
    if (!existing) {
      skills.practiceSkill(allSkills, skill, category, "");
      registered.push(`${skill} (${category})`);
    }
  }

  if (registered.length > 0) {
    skills.saveSkills(allSkills);
    return {
      content: [{ type: "text", text: `Discovered and registered ${registered.length} new skills:\n${registered.join("\n")}` }],
    };
  }

  return {
    content: [{ type: "text", text: "No new skills discovered. All project dependencies are already tracked." }],
  };
}

/**
 * Handle skill_suggest tool
 */
export async function handleSkillSuggest(args) {
  const task = args?.task;

  if (!task) {
    return {
      content: [{ type: "text", text: "Error: 'task' parameter is required" }],
      isError: true,
    };
  }

  const allSkills = skills.loadSkills();
  const result = skills.suggestSkills(task, allSkills);
  const formatted = skills.formatSuggestions(result);

  return {
    content: [{ type: "text", text: formatted }],
  };
}

/**
 * Handle skill_distill tool
 */
export async function handleSkillDistill(args) {
  const memoryId = args?.memory_id;
  const skillName = args?.skill;
  const category = args?.category || "tool"; // Default to tool if not provided

  if (!memoryId || !skillName) {
    return {
      content: [{ type: "text", text: "Error: 'memory_id' and 'skill' parameters are required" }],
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

  const allSkills = skills.loadSkills();
  const updated = skills.promoteToSkill(
    allSkills,
    skillName,
    category,
    fragment.fragment,
    fragment.project || "global"
  );

  skills.saveSkills(allSkills);

  let response = `Successfully distilled memory [${memoryId}] into skill "${updated.skill}" (${updated.category}).\n\n`;
  response += skills.formatSkillDetail(updated);

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
      case "skill_get":
        return await handleSkillGet(args);
      case "skill_practice":
        return await handleSkillPractice(args);
      case "skill_update":
        return await handleSkillUpdate(args);
      case "skill_forget":
        return await handleSkillForget(args);
      case "skill_create":
        return await handleSkillCreate(args);
      case "skill_discover":
        return await handleSkillDiscover();
      case "skill_suggest":
        return await handleSkillSuggest(args);
      case "skill_distill":
        return await handleSkillDistill(args);
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
