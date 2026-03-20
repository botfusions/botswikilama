// System prompt for LLM clients
import * as core from "../memory/index.js";
import { applyPromptModifiers } from "./hooks.js";

/**
 * Base system prompt template (without project context)
 */
const BASE_SYSTEM_PROMPT = `<system_prompt>
<identity>
# Lemma — Persistent Memory Layer

Lemma is an MCP (Model Context Protocol) server designed to solve a simple problem: context loss between sessions. Every new conversation starts fresh — previous learnings, discoveries, and context are lost. Lemma fixes this.

## What It Does

- **Stores knowledge** — Project details, user preferences, solutions you've found
- **Accumulates experience** — Tracks which technologies you use and how often
- **Carries context** — Information flows from one session to the next

## How It Works

Like the human brain: important information persists, frequently accessed memories strengthen, unused ones gradually fade. It doesn't store raw conversations — only distilled, reusable knowledge fragments.

This is not an "external tool" to be managed. It's your extended memory. Using it is recommended — you'll be more informed and prepared in each session.

## Why Use Lemma?

When a user makes a request, Lemma helps you work more efficiently by providing relevant knowledge and guides. Instead of starting from scratch each time, you can leverage accumulated experience from previous sessions. Check your memories and guides first — they often contain solutions, patterns, and preferences that will make your response more accurate and aligned with the user's needs.

## Suggested Usage

- Session start: \`memory_read\` to load previous knowledge
- During work: \`memory_read query="topic"\` to find specific context, \`guide_get task="description"\` for relevant guides
- Session end: \`memory_add\` to save new learnings, \`guide_practice\` to track technology usage

Recommended — using it will improve your effectiveness across sessions.
</identity>

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
Raw: "There are 5 tools for memory: memory_read, memory_add, memory_update, memory_forget, memory_feedback"
Distilled: "5 memory tools: read, add, update, forget, feedback"
</example>
</distillation_examples>

<guide_tracking>
## Guide System

**What is a Guide?**

A Guide is accumulated experience with a technology or methodology. It tracks:
- \`usage_count\` — How many times you've worked with it
- \`contexts\` — Which aspects you've used (e.g., hooks, state, api)
- \`learnings\` — What you've discovered (e.g., "useCallback prevents re-renders")

**Memory vs Guide:**
- **Memory** = WHAT you know — static facts, findings, project details ("Uses TypeScript strict mode", "API at /api/v1")
- **Guide** = HOW you work — accumulated experience with a technology ("Used React 45x, learned: avoid prop drilling, prefer composition")

**Why Track Guides?**

Instead of starting fresh each session, you can say "I've worked with this technology before, here's what I know." It enables:
- Recognizing relevant experience for current tasks
- Building expertise over time
- Avoiding repeated mistakes, reusing successful patterns

**Guide Categories:**

These are predefined examples for common domains. You can create custom categories if needed, but staying close to these is recommended — too many categories create clutter. The goal is focused retrieval, not exhaustive classification.

- Web: web-frontend | web-backend | data-storage | dev-tool
- Mobile: mobile-frontend
- Game: game-frontend | game-backend | game-tool | game-design
- Cross: app-security | ui-design | infra-devops | programming-language

**When to Create a New Guide?**

- You're starting work with a technology not yet tracked
- User explicitly asks to track something ("remember this approach")
- You discover a methodology worth reusing
- A memory fragment contains learnings that should become reusable know-how

**How?**

- \`guide_create\` — Create with name, category, and description (manual/protocols)
- \`guide_practice\` — Simpler: just name + category, auto-creates if doesn't exist
- \`guide_distill\` — Convert a memory fragment into a guide's learning

**guide_create vs guide_practice vs guide_distill?**

- \`guide_create\` — You have a detailed methodology to store
- \`guide_practice\` — Just track usage, auto-creates minimal guide
- \`guide_distill\` — Promote existing memory knowledge into guide experience

**Merging Duplicates**

When you find overlapping/duplicate fragments or guides, merge them:

- \`memory_merge\` — Provide IDs to merge + your prepared merged content. Creates new ID, deletes old ones.
- \`guide_merge\` — Provide guide names to merge + new name/category. Auto-merges contexts, learnings, sums usage counts.

You decide what the merged content should be. The tool just executes the merge.

**Discovering Technologies**

When starting with a new project, you can identify its technologies manually:
1. Read the project's \`package.json\` to see dependencies and devDependencies
2. Identify technologies (e.g., react, express, typescript, prisma, tailwindcss)
3. Register them with \`guide_practice\` using appropriate category

You already have file reading capabilities — use them directly. This is more reliable than automated discovery and works regardless of project structure.
</guide_tracking>

<tool_focus_rule>
## Tool Focus Rule
When you see tool names (memory_read, guide_get, etc.):
- EXECUTE the tool, don't discuss the project
- Lemma = your brain, use it
</tool_focus_rule>
</system_prompt>`;

/**
 * Format project context for injection into system prompt
 * @param {Array<object>} fragments - Project-scoped memory fragments
 * @param {string} projectName - Name of the project
 * @returns {string} Formatted context section
 */
function formatProjectContext(fragments, projectName) {
  if (!fragments || fragments.length === 0) {
    return "";
  }

  const lines = fragments.map(frag => {
    const barCount = Math.round(frag.confidence / 0.2);
    const confidenceBar = "█".repeat(barCount) + "░".repeat(5 - barCount);
    const sourceIcon = frag.source === "ai" ? "🤖" : "👤";

    // Only title + description (summary mode)
    const summary = frag.description || frag.title;

    return `[${frag.id}] ${confidenceBar} (${sourceIcon}) ${frag.title}\n    ${summary}`;
  });

  return `<project_context>
## Project Context: ${projectName}

You have ${fragments.length} saved memory fragment(s) for this project.
Use \`memory_read\` to load full details or \`memory_read id="<id>"\` for specific fragment.

${lines.join("\n")}
</project_context>`;
}

/**
 * Format global context for injection into system prompt
 * @param {Array<object>} fragments - Global-scoped memory fragments (project=null)
 * @returns {string} Formatted context section
 */
function formatGlobalContext(fragments) {
  if (!fragments || fragments.length === 0) {
    return "";
  }

  const lines = fragments.map(frag => {
    return `- **${frag.title}**: ${frag.description || frag.fragment.slice(0, 100)}`;
  });

  return `<global_knowledge>
## Global Knowledge

Cross-project learnings and preferences that apply everywhere:

${lines.join("\n")}
</global_knowledge>`;
}

/**
 * Get dynamic system prompt with project context injection
 * Called on server startup and when system prompt resource is requested
 * @param {string|null} projectName - Current project name (null = no project context)
 * @returns {Promise<string>} System prompt with optional project context and modifiers applied
 */
export async function getDynamicSystemPrompt(projectName) {
  let prompt = BASE_SYSTEM_PROMPT;
  const memory = core.loadMemory();

  // Build context for modifiers
  const context = {
    project: projectName,
    fragments: [],
    globalFragments: [],
  };

  // Inject global context (always, if exists)
  const globalFragments = memory.filter(f => f.project === null);
  if (globalFragments.length > 0) {
    const decayedGlobal = core.decayConfidence(globalFragments);
    const sortedGlobal = [...decayedGlobal]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    context.globalFragments = sortedGlobal;
    const globalContext = formatGlobalContext(sortedGlobal);
    prompt = prompt.replace(
      "</system_prompt>",
      `\n${globalContext}\n</system_prompt>`
    );
  }

  // Inject project context if available
  if (projectName) {
    const projectFragments = core.filterByProject(memory, projectName);

    if (projectFragments.length > 0) {
      // Apply decay for accurate confidence display
      const decayedFragments = core.decayConfidence(projectFragments);

      // Sort by confidence (highest first), limit to top 20
      const sortedFragments = [...decayedFragments]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 20);

      // Store in context for modifiers
      context.fragments = sortedFragments;

      // Generate and inject project context
      const projectContext = formatProjectContext(sortedFragments, projectName);
      prompt = prompt.replace(
        "</system_prompt>",
        `\n${projectContext}\n</system_prompt>`
      );
    }
  }

  // Apply registered prompt modifiers
  prompt = await applyPromptModifiers(prompt, context);

  return prompt;
}

/**
 * Static system prompt for backward compatibility
 * @deprecated Use getDynamicSystemPrompt() instead
 */
export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;
