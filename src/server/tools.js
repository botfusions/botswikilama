// Tool definitions for MCP server
export const TOOLS = [
  {
    name: "memory_read",
    description: "Read and return formatted memory fragments for LLM consumption. Applies confidence decay, limits to top-K, and reformats for optimum context.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name to filter (optional, defaults to detected project)",
        },
        query: {
          type: "string",
          description: "Optional semantic search keyword. Supply only if you are looking for specific context.",
        },
      },
    },
  },
  {
    name: "memory_check",
    description: "MANDATORY: Call this BEFORE any analysis, research, or document reading. Checks if project/topic already exists in memory. Prevents redundant work.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name to check (optional, defaults to detected project)",
        },
      },
    },
  },
  {
    name: "memory_add",
    description: "MANDATORY: Call this AFTER completing analysis/research to save findings. Synthesize information into short, reusable fragments.",
    inputSchema: {
      type: "object",
      properties: {
        fragment: {
          type: "string",
          description: "The memory fragment text to store",
        },
        title: {
          type: "string",
          description: "Short title for the memory (auto-generated if not provided)",
        },
        project: {
          type: "string",
          description: "Project scope (null = global, string = project-specific). Use current project name for project-specific info.",
          default: null,
        },
        source: {
          type: "string",
          description: "Source of the memory (default: 'ai')",
          default: "ai",
        },
      },
      required: ["fragment"],
    },
  },
  {
    name: "memory_update",
    description: "Update an existing memory fragment by ID. Can update title, fragment text, confidence, or all.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the fragment to update",
        },
        title: {
          type: "string",
          description: "New title text (optional)",
        },
        fragment: {
          type: "string",
          description: "New fragment text (optional)",
        },
        confidence: {
          type: "number",
          description: "New confidence value 0-1 (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "memory_forget",
    description: "Remove a memory fragment by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the fragment to remove",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "memory_list",
    description: "List memory fragments in JSON format. By default shows only current project + global. Use all=true to see all projects.",
    inputSchema: {
      type: "object",
      properties: {
        all: {
          type: "boolean",
          description: "If true, show all fragments from all projects. Default: false (current project only)",
        },
      },
    },
  },
  {
    name: "skill_get",
    description: "Get all tracked skills with usage statistics. Returns skills sorted by usage count (most used first).",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category (frontend, backend, tool, language, database). Optional.",
        },
        skill: {
          type: "string",
          description: "Get detail for a specific skill name. Optional.",
        },
      },
    },
  },
  {
    name: "skill_practice",
    description: "MANDATORY: Record skill usage - increments usage count, updates last_used date, and adds contexts/learnings. Call this when you use a skill during work. Both contexts and learnings are REQUIRED.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Skill name (e.g., 'react', 'python', 'git')",
        },
        category: {
          type: "string",
          description: "Category: frontend, backend, tool, language, database",
        },
        description: {
          type: "string",
          description: "Detailed description, manual, or protocols for the skill. Optional.",
        },
        contexts: {
          type: "array",
          items: { type: "string" },
          description: "REQUIRED: Contexts where this skill was used (e.g., ['hooks', 'state']). Provide at least one context or empty array [].",
        },
        learnings: {
          type: "array",
          items: { type: "string" },
          description: "REQUIRED: New learnings discovered during use (e.g., ['useCallback prevents re-renders']). Provide at least one learning or empty array [].",
        },
      },
      required: ["skill", "category", "contexts", "learnings"],
    },
  },
  {
    name: "skill_create",
    description: "Definition mode: Create a new skill with a detailed manual, mission, and protocols. Use this to establish a reusable framework for a specific technology or methodology.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Skill name (e.g., 'X Viral Growth Engine', 'TDD Workflow')",
        },
        category: {
          type: "string",
          description: "Category: frontend, backend, tool, language, database",
        },
        description: {
          type: "string",
          description: "The full manual, protocols, mission, and templates for this skill.",
        },
        contexts: {
          type: "array",
          items: { type: "string" },
          description: "Initial contexts (optional).",
        },
        learnings: {
          type: "array",
          items: { type: "string" },
          description: "Initial learnings (optional).",
        },
      },
      required: ["skill", "category", "description"],
    },
  },
  {
    name: "skill_discover",
    description: "Auto-discover skills from current project by analyzing package.json, config files, and file extensions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "skill_suggest",
    description: "Suggest relevant skills based on a task description. Analyzes the task and returns matching skills - both tracked (with experience) and untracked (new suggestions). Use this when user asks 'hangi skiller gerekli', 'uygun skiller var mı', or starting a new task.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Task description to analyze for skill suggestions (e.g., 'react component with hooks', 'nodejs api development', 'python data analysis')",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "skill_distill",
    description: "Transform a memory fragment (static fact) into a skill's learning (procedural knowledge). Use this when a learned piece of information should become part of a permanent capability.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "ID of the memory fragment to distill",
        },
        skill: {
          type: "string",
          description: "Target skill name (e.g., 'react', 'git'). If it doesn't exist, it will be created.",
        },
        category: {
          type: "string",
          description: "Category for the skill (required only if creating a new skill).",
        },
      },
      required: ["memory_id", "skill"],
    },
  },
  {
    name: "skill_update",
    description: "Update an existing skill's basic properties (name, category, description).",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Current name of the skill to update",
        },
        new_name: {
          type: "string",
          description: "New name for the skill (optional)",
        },
        category: {
          type: "string",
          description: "New category for the skill (optional)",
        },
        description: {
          type: "string",
          description: "New description/manual for the skill (optional)",
        },
      },
      required: ["skill"],
    },
  },
  {
    name: "skill_forget",
    description: "Remove a skill from the persistent database.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Name of the skill to remove",
        },
      },
      required: ["skill"],
    },
  },
];
