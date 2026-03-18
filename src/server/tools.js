// Tool definitions for MCP server
export const TOOLS = [
  {
    name: "memory_read",
    description: "Read memory fragments for LLM. SUMMARY MODE: Shows title + description only (not full content). Use id parameter to get full detail of a specific fragment.",
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
        id: {
          type: "string",
          description: "Get FULL DETAIL for a specific fragment ID. Use this after seeing the summary to read the complete content.",
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
        description: {
          type: "string",
          description: "Short description/summary (auto-generated if not provided)",
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
    name: "guide_get",
    description: "Get all tracked guides with usage statistics. Returns guides sorted by usage count (most used first).",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category (web-frontend, web-backend, dev-tool, etc.). Optional.",
        },
        guide: {
          type: "string",
          description: "Get detail for a specific guide name. Optional.",
        },
      },
    },
  },
  {
    name: "guide_practice",
    description: "MANDATORY: Record guide usage - increments usage count, updates last_used date, and adds contexts/learnings. Call this when you use a guide during work. Both contexts and learnings are REQUIRED.",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Guide name (e.g., 'react', 'python', 'git')",
        },
        category: {
          type: "string",
          description: "Category: web-frontend, web-backend, dev-tool, programming-language, data-storage, etc.",
        },
        description: {
          type: "string",
          description: "Detailed description, manual, or protocols for the guide. Optional.",
        },
        contexts: {
          type: "array",
          items: { type: "string" },
          description: "REQUIRED: Contexts where this guide was used (e.g., ['hooks', 'state']). Provide at least one context or empty array [].",
        },
        learnings: {
          type: "array",
          items: { type: "string" },
          description: "REQUIRED: New learnings discovered during use (e.g., ['useCallback prevents re-renders']). Provide at least one learning or empty array [].",
        },
      },
      required: ["guide", "category", "contexts", "learnings"],
    },
  },
  {
    name: "guide_create",
    description: "Definition mode: Create a new guide with a detailed manual, mission, and protocols. Use this to establish a reusable framework for a specific technology or methodology.",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Guide name (e.g., 'X Viral Growth Engine', 'TDD Workflow')",
        },
        category: {
          type: "string",
          description: "Category: web-frontend, web-backend, dev-tool, programming-language, data-storage, etc.",
        },
        description: {
          type: "string",
          description: "The full manual, protocols, mission, and templates for this guide.",
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
      required: ["guide", "category", "description"],
    },
  },
  {
    name: "guide_discover",
    description: "Auto-discover guides from current project by analyzing package.json, config files, and file extensions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "guide_suggest",
    description: "Suggest relevant guides based on a task description. Analyzes the task and returns matching guides - both tracked (with experience) and untracked (new suggestions). Use this when user asks 'hangi guide lar gerekli', 'uygun rehberler var mı', or starting a new task.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Task description to analyze for guide suggestions (e.g., 'react component with hooks', 'nodejs api development', 'python data analysis')",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "guide_distill",
    description: "Transform a memory fragment (static fact) into a guide's learning (procedural knowledge). Use this when a learned piece of information should become part of a permanent capability.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "ID of the memory fragment to distill",
        },
        guide: {
          type: "string",
          description: "Target guide name (e.g., 'react', 'git'). If it doesn't exist, it will be created.",
        },
        category: {
          type: "string",
          description: "Category for the guide (required only if creating a new guide).",
        },
      },
      required: ["memory_id", "guide"],
    },
  },
  {
    name: "guide_update",
    description: "Update an existing guide's basic properties (name, category, description).",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Current name of the guide to update",
        },
        new_name: {
          type: "string",
          description: "New name for the guide (optional)",
        },
        category: {
          type: "string",
          description: "New category for the guide (optional)",
        },
        description: {
          type: "string",
          description: "New description/manual for the guide (optional)",
        },
      },
      required: ["guide"],
    },
  },
  {
    name: "guide_forget",
    description: "Remove a guide from the persistent database.",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Name of the guide to remove",
        },
      },
      required: ["guide"],
    },
  },
  {
    name: "memory_merge",
    description: "Merge multiple memory fragments into one. You decide the merged content, this tool just executes the merge. Use when you find related/overlapping fragments that should be consolidated.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of fragment IDs to merge (will be deleted after merge)",
        },
        title: {
          type: "string",
          description: "Title for the merged fragment",
        },
        fragment: {
          type: "string",
          description: "The merged content you prepared",
        },
        project: {
          type: "string",
          description: "Project scope (null = global, string = project-specific). Optional.",
          default: null,
        },
      },
      required: ["ids", "title", "fragment"],
    },
  },
  {
    name: "guide_merge",
    description: "Merge multiple guides into one. You decide the merged content (description, contexts, learnings). Usage counts are summed. Use when you find overlapping guides that should be consolidated.",
    inputSchema: {
      type: "object",
      properties: {
        guides: {
          type: "array",
          items: { type: "string" },
          description: "Array of guide names to merge (will be deleted after merge)",
        },
        guide: {
          type: "string",
          description: "Name for the merged guide",
        },
        category: {
          type: "string",
          description: "Category for the merged guide",
        },
        description: {
          type: "string",
          description: "Merged description/manual (optional, can be empty)",
        },
        contexts: {
          type: "array",
          items: { type: "string" },
          description: "Merged contexts (optional, will auto-merge from source guides if not provided)",
        },
        learnings: {
          type: "array",
          items: { type: "string" },
          description: "Merged learnings (optional, will auto-merge from source guides if not provided)",
        },
      },
      required: ["guides", "guide", "category"],
    },
  },
];
