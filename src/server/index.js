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
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "lemma://system-prompt",
        name: "Lemma System Prompt",
        description: "System prompt for LLM clients using Lemma memory",
        mimeType: "text/markdown",
      },
      {
        uri: "lemma://memory",
        name: "Memory Fragments",
        description: "Current memory fragments (raw JSON)",
        mimeType: "application/json",
      },
      {
        uri: "lemma://skills",
        name: "Skills Database",
        description: "Tracked skills with usage statistics (raw JSON)",
        mimeType: "application/json",
      },
    ],
  };
});

// Register read resource handler
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

  if (uri === "lemma://memory") {
    const memory = core.loadMemory();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(memory, null, 2),
        },
      ],
    };
  }

  if (uri === "lemma://skills") {
    const allSkills = skills.loadSkills();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(allSkills, null, 2),
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
