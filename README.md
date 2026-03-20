<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - Persistent Memory for LLMs via MCP

[English](README.md) | [Türkçe](README.tr.md)

Lemma is a Model Context Protocol (MCP) server that provides a persistent memory layer for Large Language Models. It enables LLMs to remember facts, preferences, and context across sessions through a simple, elegant interface with automatic memory decay and learning.

## What is Lemma?

Lemma acts as an external hippocampus for AI assistants. The human brain does not record everything — it synthesizes, distills, and leaves behind fragments. Frequently accessed knowledge grows stronger; unused knowledge fades and is forgotten.

Lemma operates on the same principle:

- **Raw conversations are never stored** — only synthesized fragments
- **Fragments decay over time** — frequently accessed ones strengthen
- **Used knowledge gains context** — tags and associations are built automatically
- **The LLM reads fragments at every session** and remembers who it is

## How It Works

### Dynamic System Prompt

Lemma automatically injects relevant context into the LLM's system prompt at runtime:

- **Global Context**: Cross-project learnings and preferences (up to 10 fragments)
- **Project Context**: Project-specific fragments with confidence visualization (up to 20 fragments)
- **Visual Formatting**: Confidence bars (`███░░`) and source icons (🤖/👤)
- **Prompt Modifiers**: Extensible system for custom prompt transformations

### Memory Structure

Each memory fragment has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (format: `m` + 6 hex chars) |
| `title` | string | Short title for quick scanning |
| `fragment` | string | Synthesized memory text |
| `project` | string | Project scope (`null` for global) |
| `confidence` | float | Reliability 0.0-1.0 (decays and boosts over time) |
| `source` | string | `"user"` or `"ai"` |
| `created` | string | Creation date (YYYY-MM-DD) |
| `lastAccessed` | string | ISO timestamp of last read |
| `accessed` | int | Access count in current decay cycle |
| `tags` | string[] | Context tags from usage (e.g., "debugging", "refactoring") |
| `associatedWith` | string[] | IDs of fragments accessed in the same session |
| `negativeHits` | int | Times this memory was marked unhelpful (resets per session) |

### Learning System

Unlike static memory, Lemma uses a biological model where knowledge evolves through use:

**Boost (on access):**
```
confidence = min(1.0, confidence + 0.1)
tags += context_tag  (e.g., "debugging")
associatedWith += co_accessed_fragment_ids
```

**Decay (per session):**
```
decay = max(0.005, 0.05 - (accessed * 0.005))
confidence = confidence - decay
```

- **Frequency**: Frequently accessed items decay slower (min 0.005 per session)
- **Unused items** decay at the base rate of 0.05 per session
- **Associations**: Fragments used together build cross-references for future recall

### Memory File Location

Memories are stored in JSONL format at:

| OS | Path |
|---|---|
| **Windows** | `C:\Users\{username}\.lemma\memory.jsonl` |
| **macOS** | `/Users/{username}/.lemma/memory.jsonl` |
| **Linux** | `/home/{username}/.lemma/memory.jsonl` |

## Quick Start

The recommended way to use Lemma is via **JSR**. Add this to your MCP client configuration:

**Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
**Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lemma": {
      "command": "npx",
      "args": ["-y", "jsr", "@lemma/lemma"]
    }
  }
}
```

### Alternative: Run directly from GitHub

```json
{
  "mcpServers": {
    "lemma": {
      "command": "npx",
      "args": ["-y", "github:xenitV1/lemma"]
    }
  }
}
```

---

## Hook System

Lemma provides a pluggable hook system for extending server behavior:

### Lifecycle Hooks

```javascript
import { registerHook, HookTypes } from "@lemma/lemma/server";

// Register a callback for server start
registerHook(HookTypes.ON_START, async (context) => {
  console.log("Server started!", context);
});

// Register a callback for project context changes
registerHook(HookTypes.ON_PROJECT_CHANGE, async (context) => {
  console.log(`Project changed to: ${context.project}`);
});
```

### Prompt Modifiers

Extend the system prompt generation with custom transformations:

```javascript
import { registerPromptModifier } from "@lemma/lemma/server";

registerPromptModifier(async (prompt, context) => {
  // Add custom context to the prompt
  if (context.project === "my-app") {
    return prompt + "\n\n<custom>Note: Using experimental features.</custom>";
  }
  return prompt;
});
```

---

## Manual Installation (For Developers)

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

**Requirements:** Node.js 18.0.0 or higher

### Local Configuration

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["C:\\path\\to\\Lemma\\src\\index.js"]
    }
  }
}
```

---

## Available Tools

### Memory Tools

#### `memory_read`

Read memory fragments. SUMMARY MODE shows title + description; use `id` for full detail.

**Parameters:**
- `project` (string, optional): Project name to filter
- `query` (string, optional): Semantic search keyword
- `id` (string, optional): Get full detail for a specific fragment
- `context` (string, optional): Tag this access with a context (e.g., "debugging") — boosts confidence
- `all` (boolean, optional): Show fragments from all projects (default: false)

**Returns:** Formatted string with confidence bars:

```
=== LEMMA MEMORY FRAGMENTS (project: myapp) ===
[m1a2b3] ████░ (🤖) [myapp] React Hooks
    useState and useEffect patterns
==============================
```

#### `memory_add`

**MANDATORY:** Call AFTER completing analysis to save findings.

**Parameters:**
- `fragment` (string, required): The memory text to store
- `title` (string, optional): Short title
- `description` (string, optional): Short summary
- `project` (string, optional): Project scope (null = global)
- `source` (string, optional): "user" or "ai", default "ai"

#### `memory_update`

Update an existing fragment by ID.

**Parameters:**
- `id` (string, required): Fragment ID
- `title` (string, optional): New title
- `fragment` (string, optional): New text
- `confidence` (number, optional): New confidence 0-1

#### `memory_feedback`

Provide feedback on a memory fragment after use. Positive feedback boosts confidence; negative feedback reduces it directly (-0.1).

**Parameters:**
- `id` (string, required): Fragment ID
- `useful` (boolean, required): `true` if helpful, `false` if not

#### `memory_forget`

Remove a memory fragment by ID.

**Parameters:**
- `id` (string, required): Fragment ID

#### `memory_merge`

Merge multiple fragments into one. Creates new ID, deletes originals.

**Parameters:**
- `ids` (string[], required): Fragment IDs to merge
- `title` (string, required): Title for merged fragment
- `fragment` (string, required): Merged content
- `project` (string, optional): Project scope

### Guide Tools

#### `guide_get`

Get tracked guides with usage statistics. Returns guides sorted by usage count (most used first).

**Parameters:**
- `category` (string, optional): Filter by category
- `guide` (string, optional): Get detail for specific guide
- `task` (string, optional): Task description to get relevant guide suggestions

#### `guide_practice`

**MANDATORY:** Record guide usage when you use a guide during work.

**Parameters:**
- `guide` (string, required): Guide name
- `category` (string, required): Category
- `description` (string, optional): Detailed manual/protocols
- `contexts` (string[], required): Contexts where used
- `learnings` (string[], required): New learnings discovered

#### `guide_create`

Create a guide with a detailed manual.

**Parameters:**
- `guide` (string, required): Guide name
- `category` (string, required): Category
- `description` (string, required): Full manual/protocols
- `contexts` (string[], optional): Initial contexts
- `learnings` (string[], optional): Initial learnings

#### `guide_distill`

Transform a memory fragment into a guide's learning.

**Parameters:**
- `memory_id` (string, required): Memory fragment ID
- `guide` (string, required): Target guide name
- `category` (string, optional): Category (required if creating new guide)

#### `guide_update`

Update an existing guide's properties.

**Parameters:**
- `guide` (string, required): Current guide name
- `new_name` (string, optional): New name
- `category` (string, optional): New category
- `description` (string, optional): New description/manual

#### `guide_forget`

Remove a guide.

**Parameters:**
- `guide` (string, required): Guide name

#### `guide_merge`

Merge multiple guides into one. Usage counts are summed.

**Parameters:**
- `guides` (string[], required): Guide names to merge
- `guide` (string, required): Name for merged guide
- `category` (string, required): Category
- `description` (string, optional): Merged description
- `contexts` (string[], optional): Merged contexts
- `learnings` (string[], optional): Merged learnings

## Philosophy

### What Should Be Stored

**User Layer:**
- User preferences (communication style, format, language)
- Project context (technology stack, folder structure, conventions)
- Explicitly requested memories

**Capability Layer:**
- Successful solutions and approaches used
- Shortcuts discovered for recurring tasks
- Approaches that were tried and failed

### What Should NOT Be Stored

- Raw conversation content
- One-off questions that won't recur
- Temporary or highly context-specific information
- Personal or sensitive data

## Development

### Running Tests

```bash
npm test
```

Comprehensive test suite covering memory core, guides core, handlers, learning lifecycle, hook system, and dynamic prompt generation. All I/O is isolated to temp directories — real data is never touched.

### Project Structure

```
Lemma/
├── src/
│   ├── index.js          # MCP server entry point
│   ├── memory/
│   │   ├── index.js      # Memory module re-exports
│   │   └── core.js       # Core memory logic
│   ├── guides/
│   │   ├── index.js      # Guides module re-exports
│   │   ├── core.js       # Core guides logic
│   │   └── task-map.js   # Task-to-guide mapping
│   └── server/
│       ├── index.js      # Server setup
│       ├── handlers.js   # Tool handlers
│       ├── tools.js      # Tool definitions
│       ├── hooks.js      # Hook system & prompt modifiers
│       └── system-prompt.js
├── tests/
│   └── test.js           # Test suite
├── package.json
├── jsr.json
├── CHANGELOG.md
└── README.md
```

## Security

`memory.jsonl` and `guides.jsonl` are local files and are never sent anywhere. Users can inspect their contents or clear them at any time via the MCP tools.

## License

MIT License
