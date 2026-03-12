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
import * as skills from "../skills/index.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { TOOLS } from "./tools.js";
import { handleCallTool } from "./handlers.js";

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
// Lists individual URIs for each memory fragment and skill (metadata only)
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

  // List each skill as individual resource (metadata only)
  const allSkills = skills.loadSkills();
  for (const skill of allSkills) {
    resources.push({
      uri: `lemma://skills/${skill.skill}`,
      name: `Skill: ${skill.skill}`,
      description: `[${skill.category}] ${skill.usage_count}x usage, ${skill.learnings.length} learnings`,
      mimeType: "application/json",
    });
  }

  return { resources };
});

// Register read resource handler
// Supports URI patterns:
// - lemma://system-prompt
// - lemma://memory/{id} - single memory fragment
// - lemma://skills/{name} - single skill by name
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "lemma://system-prompt") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: SYSTEM_PROMPT,
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

  // Single skill by name: lemma://skills/{name}
  if (uri.startsWith("lemma://skills/")) {
    const skillName = uri.replace("lemma://skills/", "").toLowerCase();
    const allSkills = skills.loadSkills();
    const skill = allSkills.find(s => s.skill === skillName);

    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(skill, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, handleCallTool);

// Start server
export async function startServer() {
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
