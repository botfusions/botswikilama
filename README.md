<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - Persistent Memory for LLMs via MCP

[English](README.md) | [Türkçe](README.tr.md)

Lemma is a Model Context Protocol (MCP) server that provides a persistent memory layer for Large Language Models. It enables LLMs to remember facts, preferences, and context across sessions through a simple, elegant interface with automatic memory decay.

## What is Lemma?

Lemma acts as an external hippocampus for AI assistants. The human brain does not record everything — it synthesizes, distills, and leaves behind fragments. Frequently accessed knowledge grows stronger; unused knowledge fades and is forgotten.

Lemma operates on the same principle:

- **Raw conversations are never stored** — only synthesized fragments
- **Fragments decay over time** — frequently accessed ones strengthen
- **The LLM reads fragments at every session** and remembers who it is

## How It Works

### Memory Structure

Each memory fragment has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (format: `m` + 6 hex chars) |
| `title` | string | Short title for quick scanning |
| `fragment` | string | Synthesized memory text |
| `project` | string | Project scope (`null` for global) |
| `confidence` | float | Reliability 0.0-1.0 (decays over time) |
| `source` | string | `"user"` or `"ai"` |
| `created` | string | Creation date (YYYY-MM-DD) |
| `lastAccessed` | string | ISO timestamp of last read |
| `accessed` | int | Access count in current decay cycle |

### Decay Mechanism

Decay is applied every time memory is read. Unlike static memory, Lemma uses a biological model where frequency of access strengthens the memory, while time elapsed since last access weakens it:

```
modifier = max(0.005, 0.05 - (accessed * 0.005))
time_multiplier = 1 + (days_since_last_access * 0.05)
decay_step = modifier * time_multiplier
confidence = confidence - decay_step
```

- **Frequency**: Frequently accessed items reach a minimum decay rate.
- **Recency**: Items not accessed for a long time decay faster due to the `time_multiplier`.
- **Cleanup**: Fragments with **confidence < 0.1** are automatically purged.

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
If you don't want to use JSR, you can run Lemma directly from GitHub:

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

## 💡 Important Recommendation for New Users

If you are using Lemma for the first time, please consider this advice:

When you first start using the system, your **Guides** and **Memory** will be empty. For the system to use Lemma fully automatically and effectively, you need to manually seed it with some initial information and guides.

**Follow these steps to get started:**
1. Ask an AI model to perform web research on a specific topic.
2. Instruct it to save the findings to Lemma's memory following its core principles.
3. Once you have some initial data, ask the system to create **Guides** based on the acquired knowledge.
4. If you have existing `SKILL.md` files or documentation, read them into the system and ask Lemma to add them to its guide set.

By doing this, the system will gradually develop its own knowledge base and guide set more effectively over time.

---

## 🚀 Manual Installation (For Developers)

If you want to modify Lemma or run it locally:

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

### Requirements

- Node.js 18.0.0 or higher

### Local Configuration

If you have cloned the repository locally, use this configuration:

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\Lemma\\memory.js"]
    }
  }
}
```

---

### NPM (Optional)
While Lemma can be run via `npx` directly from GitHub, you can also publish to NPM if you prefer:
```bash
npm publish --access public
```

---

## ⚓ System Prompt

The server provides a system prompt resource at `lemma://system-prompt`. MCP clients can discover this automatically.

**Manual configuration** (if needed):

```xml
<system_prompt>
<identity>
# Lemma — YOUR BRAIN
When you see Lemma, KNOW THIS:
- This is YOUR memory layer — your knowledge, experiences, guides are stored here
- Learnings from previous sessions are saved here
- User preferences, project details, learned guides are all here
- Every session: Start with **memory_read** → load your knowledge → End with **memory_add** → save new learnings
- This is NOT an "external tool" — it is YOUR extended memory
</identity>

<intro>
## How It Works
Like the human brain: important information is retained, frequently accessed memories grow stronger, unused ones fade over time.
</intro>

<core_workflow>
## Core Workflow (FOLLOW THIS)
1. **Session Start** → Call `memory_read` (load your knowledge)
2. **Context Discovery** → Call `memory_check` + `guide_suggest` (what do you know? what's needed?)
3. **Execution** → Apply learned guides and knowledge
4. **Session End** → Call `memory_add` + `guide_practice` (save what you learned)
</core_workflow>

<scope_rules>
## Scope Rules
| Scope | Use For | Example |
|-------|---------|---------|
| project: null | Global preferences | "User prefers dark mode" |
| project: "Name" | Project-specific | "Lemma uses Node.js 18+" |
</scope_rules>

<distillation_examples>
## Distillation Examples
<example>
Raw: "The project uses package.json with dependencies like @modelcontextprotocol/sdk version 1.0.0"
Distilled: "MCP SDK 1.0.0, Node.js 18+"
</example>
<example>
Raw: "There are 5 tools for memory: memory_read, memory_add, memory_update, memory_forget, memory_list"
Distilled: "5 memory tools: read, add, update, forget, list"
</example>
</distillation_examples>

<guide_tracking>
## Guide Tracking
**Memory vs Guide:**
- Memory = Static knowledge fragments ("React uses virtual DOM")
- Guide = Procedural knowledge, "how-to" guides, experience tracking

**Guide Categories:**
- Web: web-frontend | web-backend | data-storage | dev-tool
- Mobile: mobile-frontend
- Game: game-frontend | game-backend | game-tool | game-design
- Cross: app-security | ui-design | infra-devops | programming-language

**For guide suggestions:** Use `guide_suggest` tool
</guide_tracking>

<tool_focus_rule>
## Tool Focus Rule
When you see tool names (memory_read, guide_get, etc.):
- EXECUTE the tool, don't discuss the project
- Lemma = your brain, use it
</tool_focus_rule>
</system_prompt>
```

## Available Tools

Read and return formatted memory fragments for LLM consumption. Applies confidence decay, limits to top-K, and reformats for optimum context.

**Parameters:**
- `project` (string, optional): Project name to filter (defaults to current project).
- `query` (string, optional): Semantic search keyword to find specific context.

**Returns:** Formatted string with confidence bars:

```
=== LEMMA MEMORY FRAGMENTS ===
[m1a2b3] █████ (🤖 ai) Communication style
    User prefers short and direct answers
[m4c5d6] █████ (👤 user) Project stack
    Project is TypeScript, Node 20
==============================
```

### `memory_check`

**MANDATORY:** Call this BEFORE any analysis, research, or document reading. Checks if project/topic already exists in memory. Prevents redundant work.

**Parameters:**
- `project` (string, optional): Project name to check (defaults to current project).

### `memory_add`

Add a new memory fragment.

**Parameters:**
- `fragment` (string, required): The memory text to store
- `title` (string, optional): Short title (auto-generated from first 40 chars if not provided)
- `source` (string, optional): "user" or "ai", default "ai"

**Example:**
```json
{
  "fragment": "User prefers dark mode in all applications",
  "title": "Dark mode preference",
  "source": "ai"
}
```

### `memory_update`

Update an existing memory fragment.

**Parameters:**
- `id` (string, required): The fragment ID to update
- `title` (string, optional): New title text
- `fragment` (string, optional): New fragment text
- `confidence` (number, optional): New confidence 0.0-1.0

**Example:**
```json
{
  "id": "m1a2b3",
  "title": "Updated title",
  "fragment": "Updated information",
  "confidence": 0.9
}
```

### `memory_forget`

Remove a memory fragment.

**Parameters:**
- `id` (string, required): The fragment ID to remove

### `memory_list`

List all memory fragments in JSON format.

**Parameters:** None

**Returns:** JSON array of all fragments

## Guide Tracking

Lemma also tracks guides you use during work. This helps build a profile of expertise over time.

### `guide_get`

Get all tracked guides with usage statistics.

**Parameters:**
- `category` (string, optional): Filter by category (frontend, backend, tool, language, database)
- `guide` (string, optional): Get detail for a specific guide name

**Returns:** Formatted guide list sorted by usage count

**Example output:**
```
=== LEMMA GUIDES ===
[frontend] react: 45x (last: 2026-03-06) [hooks, jsx, state] (3 learnings)
[backend] nodejs: 30x (last: 2026-03-05) [express, api]
[language] typescript: 25x (last: 2026-03-06)
====================
```

### `guide_practice`

Record guide usage - increments usage count, updates last_used date, and optionally adds contexts/learnings.

**Parameters:**
- `guide` (string, required): Guide name (e.g., "react", "python", "git")
- `category` (string, required): Category: frontend, backend, tool, language, database
- `contexts` (array of strings, optional): Additional contexts (e.g., ["hooks", "state"])
- `learnings` (array of strings, optional): New learnings discovered during use

**Example:**
```json
{
  "guide": "react",
  "category": "frontend",
  "contexts": ["hooks", "useCallback"],
  "learnings": ["useCallback prevents unnecessary re-renders"]
}
```

### `guide_discover`

Auto-discover guides from current project by analyzing package.json dependencies.

**Parameters:** None

**Returns:** List of newly discovered and registered guides

### `guide_create`

**New:** Create a new guide with a detailed manual, mission, and protocols. This allows you to establish a "Manager Guide" framework rather than just tracking usage.

**Parameters:**
- `guide` (string, required): Guide name (e.g., "X Viral Growth Engine")
- `category` (string, required): Category
- `description` (string, required): The full manual, protocols, mission, and templates for this guide.
- `contexts` (array, optional): Initial contexts.
- `learnings` (array, optional): Initial learnings.

### Guide File Location

Guides are stored in JSONL format at:

| OS | Path |
|---|---|
| **Windows** | `C:\Users\{username}\.lemma\guides.jsonl` |
| **macOS** | `/Users/{username}/.lemma/guides.jsonl` |
| **Linux** | `/home/{username}/.lemma/guides.jsonl` |

### Guide Data Structure

```json
{
  "id": "g1a2b3",
  "guide": "react",
  "category": "frontend",
  "usage_count": 45,
  "last_used": "2026-03-06",
  "contexts": ["hooks", "jsx", "state"],
  "learnings": ["useCallback prevents unnecessary re-renders"]
}
```

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
- Task types and their best-fit strategy patterns

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

### Project Structure

```
Lemma/
├── memory.js       # Main MCP server implementation
├── memory-core.js  # Core memory logic (load, save, decay)
├── test.js         # Test suite
├── package.json    # Dependencies and metadata
├── README.md       # This file
└── .gitignore      # Git ignore rules
```

## Security

`memory.jsonl` is a local file and is never sent anywhere. Users can inspect its contents or clear it at any time via the MCP tools.

## License

MIT License
