#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
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

// Register list resources handler
// Lists individual URIs for each memory fragment and guide (metadata only)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
    {
      uri: "lemma://system-prompt",
      name: "Lemma System Prompt",
      description: "System prompt for LLM clients using Lemma memory",
      mimeType: "text/markdown",
    },
  ];

  // List each memory fragment as individual resource (metadata only)
  const memory = core.loadMemory();
  for (const frag of memory) {
    const scopeTag = frag.project ? `[${frag.project}]` : "[global]";
    resources.push({
      uri: `lemma://memory/${frag.id}`,
      name: `Memory: ${frag.title}`,
      description: `${scopeTag} confidence: ${(frag.confidence * 100).toFixed(0)}%`,
      mimeType: "application/json",
    });
  }

  // List each guide as individual resource (metadata only)
  const allGuides = guides.loadGuides();
  for (const guide of allGuides) {
    resources.push({
      uri: `lemma://guides/${guide.guide}`,
      name: `Guide: ${guide.guide}`,
      description: `[${guide.category}] ${guide.usage_count}x usage, ${guide.learnings.length} learnings`,
      mimeType: "application/json",
    });
  }

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
    const dynamicPrompt = getDynamicSystemPrompt(detectedProject);
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
