#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";
import { getDynamicSystemPrompt } from "./system-prompt.js";
import { TOOLS } from "./tools.js";
import { handleCallTool } from "./handlers.js";
import { triggerHook, HookTypes } from "./hooks.js";

// Detected project context (set on startup)
let detectedProject = null;

// Create MCP server instance
const server = new Server(
  {
    name: "lemma",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

/**
 * Build dynamic instructions for initialize response
 * @param {string|null} projectName - Detected project name
 * @returns {string} Formatted instructions with project context
 */
function buildDynamicInstructions(projectName) {
  const memory = core.loadMemory();
  const decayedMemory = core.decayConfidence(memory);

  // Get project-specific fragments
  const projectFragments = projectName
    ? core.filterByProject(decayedMemory, projectName)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 20)
    : [];

  // Get global fragments (always include top 10)
  const globalFragments = core.filterByProject(decayedMemory, null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);

  // Get guides (only name and description)
  const allGuides = guides.loadGuides();
  const topGuides = guides.getTopGuides(allGuides, 30);

  let instructions = `# Lemma Memory Context\n\n`;

  // Project context
  if (projectName && projectFragments.length > 0) {
    instructions += `## 📁 Project: ${projectName}\n`;
    instructions += `You have ${projectFragments.length} saved memories for this project.\n\n`;
    instructions += `| ID | Title | Description |\n`;
    instructions += `|---|---|---|\n`;
    for (const frag of projectFragments) {
      const desc = (frag.description || frag.fragment?.slice(0, 80) || '').replace(/\n/g, ' ').slice(0, 100);
      instructions += `| ${frag.id} | ${frag.title} | ${desc} |\n`;
    }
    instructions += `\nUse \`memory_read id="<id>"\` to get full content.\n\n`;
  } else if (projectName) {
    instructions += `## 📁 Project: ${projectName}\n`;
    instructions += `No saved memories for this project yet. Start working to build memory.\n\n`;
  }

  // Global context
  if (globalFragments.length > 0) {
    instructions += `## 🌐 Global Knowledge\n`;
    instructions += `Cross-project learnings:\n\n`;
    instructions += `| ID | Title | Description |\n`;
    instructions += `|---|---|---|\n`;
    for (const frag of globalFragments) {
      const desc = (frag.description || frag.fragment?.slice(0, 80) || '').replace(/\n/g, ' ').slice(0, 100);
      instructions += `| ${frag.id} | ${frag.title} | ${desc} |\n`;
    }
    instructions += `\n`;
  }

  // Guides section (only name and description)
  if (topGuides.length > 0) {
    instructions += `## 📚 Available Guides\n`;
    instructions += `| Name | Category |\n`;
    instructions += `|---|---|\n`;
    for (const guide of topGuides) {
      instructions += `| ${guide.guide} | ${guide.category} |\n`;
    }
    instructions += `\nUse \`guide_get guide="<name>"\` to see full details.\n\n`;
  }

  instructions += `**Tip:** Call \`memory_read\` to refresh memories or \`guide_get task="<your task>"\` to find relevant guides.`;

  return instructions;
}

// Register initialize handler - returns dynamic instructions with project context
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  // Detect project on initialize
  detectedProject = core.detectProject();

  if (detectedProject) {
    console.error(`[Lemma] Detected project: ${detectedProject}`);
  }

  // Build dynamic instructions
  const instructions = buildDynamicInstructions(detectedProject);

  // Return initialize result with dynamic instructions
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      resources: {},
    },
    serverInfo: {
      name: "lemma",
      version: "1.0.0",
    },
    instructions,
  };
});

// Register list resources handler
// Only exposes system-prompt resource - memories and guides are accessed via tools
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
    {
      uri: "lemma://system-prompt",
      name: "Lemma System Prompt",
      description: "System prompt for LLM clients using Lemma memory",
      mimeType: "text/markdown",
    },
  ];

  return { resources };
});

// Register read resource handler
// Supports URI patterns:
// - lemma://system-prompt
// - lemma://memory/{id} - single memory fragment
// - lemma://guides/{name} - single guide by name
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "lemma://system-prompt") {
    // Return dynamic system prompt with project context injection
    const dynamicPrompt = await getDynamicSystemPrompt(detectedProject);
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: dynamicPrompt,
        },
      ],
    };
  }

  // Single memory fragment by ID: lemma://memory/{id}
  if (uri.startsWith("lemma://memory/")) {
    const id = uri.replace("lemma://memory/", "");
    const memory = core.loadMemory();
    const fragment = memory.find(f => f.id === id);

    if (!fragment) {
      throw new Error(`Memory fragment not found: ${id}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(fragment, null, 2),
        },
      ],
    };
  }

  // Single guide by name: lemma://guides/{name}
  if (uri.startsWith("lemma://guides/")) {
    const guideName = uri.replace("lemma://guides/", "").toLowerCase();
    const allGuides = guides.loadGuides();
    const guide = allGuides.find(g => g.guide === guideName);

    if (!guide) {
      throw new Error(`Guide not found: ${guideName}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(guide, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, handleCallTool);

/**
 * Initialize server context on startup
 * - Detect project from working directory
 * - Trigger onStart hooks
 */
async function initializeContext() {
  // Detect project from current working directory
  detectedProject = core.detectProject();

  if (detectedProject) {
    // Log to stderr (doesn't interfere with stdio transport)
    console.error(`[Lemma] Detected project: ${detectedProject}`);

    // Check if project has memories
    const memory = core.loadMemory();
    const projectFragments = core.filterByProject(memory, detectedProject);

    if (projectFragments.length > 0) {
      console.error(`[Lemma] Found ${projectFragments.length} memory fragment(s) for this project`);
    } else {
      console.error(`[Lemma] No saved memories for this project yet`);
    }
  } else {
    console.error(`[Lemma] No project detected (running in global context)`);
  }

  // Trigger onStart hooks with project context
  await triggerHook(HookTypes.ON_START, {
    project: detectedProject,
    timestamp: new Date().toISOString(),
  });
}

// Start server
export async function startServer() {
  // Initialize context before starting transport
  await initializeContext();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now listening on stdin/stdout
}

// Auto-start when run directly
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  startServer().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
