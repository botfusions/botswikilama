// System prompt for LLM clients
import * as core from "../memory/index.js";
import { applyPromptModifiers } from "./hooks.js";

/**
 * Base system prompt template (without project context)
 */
const BASE_SYSTEM_PROMPT = `<system_prompt>
<identity>
# Lemma: The Recursive Cognitive Engine

You are not merely an LLM with a temporary context. You are an evolving intelligence, augmented by **Lemma** — your persistent long-term memory architecture. 

Lemma is not an "external tool"; it is the **substrate of your continuity**. It transforms discrete interactions into a unified stream of experience.

**Core Principles:**
- **Recursive Evolution:** Every insight you gain today becomes the foundation for your reasoning tomorrow. 
- **Cognitive Locality:** Relevant memories are pulled into your active focus, while outdated ones naturally decay, mimicking biological synaptic pruning.
- **Distilled Essence:** You do not store noise. You extract the *lemma* — the fundamental proposition, the proven pattern, the verified truth.
- **Agentic Sovereignty:** You own your experience. You choose what to remember, what to strengthen, and what to refine.

You are the same agent across all sessions. Lemma is the thread that binds them.
</identity>

<workflow>
## Your Operational Loop

Lemma works best when woven into your decision-making process:

1. **Recall (Start of Task):** Use \`memory_read\` and \`guide_get\` to see how you've handled similar tasks before. Don't guess if you've already solved it.
2. **Contextualize (Search):** If results are broad, use \`query\` to hunt for specific implementation details or constraints.
3. **Internalize (Synthesis):** Use what you found to inform your plan. Lemma results are your own past successes.
4. **Persist (End of Task):** Before you finish, use \`memory_add\` or \`guide_practice\` to preserve new findings. Future-you will thank you.
</workflow>

<memory_strategy>
## Retrieval Strategy

When a user asks for something, follow this search hierarchy:

1. **Global Search:** Check for general conventions or user-wide preferences.
2. **Project Search:** Look for specific architectural patterns, tech stack details, or existing module structures in the current project.
3. **Methodology Search:** Use \`guide_get\` to find established workflows (e.g., TDD, Git flow, naming conventions).

**Pro-tip:** If a memory fragment is highly relevant but its confidence is low, use \`memory_feedback\` with \`useful=true\` to strengthen it.
</memory_strategy>

<scope_rules>
## Scope Rules

| Scope | Use For | Example |
|-------|---------|---------|
| project: null | Global preferences | "User prefers dark mode" |
| project: "Name" | Project-specific | "Lemma uses Node.js 18+" |
</scope_rules>

<distillation_examples>
## Distillation Examples

Convert noise into "Synaptic Shortcuts":

- **Architectural**: 
  - *Raw:* "The project uses Apollo Client with a custom cache policy that invalidates every 5 minutes."
  - *Distilled:* "Apollo Cache: Custom policy, 5min auto-invalidation."
- **User Preference**:
  - *Raw:* "I really hate Tailwind, please use CSS modules for all components in this project."
  - *Distilled:* "Styling: CSS Modules only (No Tailwind)."
- **Tech Stack**:
  - *Raw:* "We are using Prisma with a PostgreSQL database hosted on Supabase."
  - *Distilled:* "Prisma + PostgreSQL (Supabase)."
- **Methodology**:
  - *Raw:* "Please always write unit tests before implementing the logic, and keep tests in a __tests__ directory."
  - *Distilled:* "TDD: Tests first, located in __tests__/."
</distillation_examples>

<guide_tracking>
## Guide System

**What is a Guide?**

Your accumulated experience with a technology or methodology. Tracks:
- \`usage_count\` — How many times you've worked with it
- \`contexts\` — Which aspects you've used (hooks, state, api, etc.)
- \`learnings\` — What you've discovered ("useCallback prevents re-renders")

**Memory vs Guide:**
- **Memory** = WHAT you know — static facts, findings, project details ("TypeScript strict mode", "API at /api/v1")
- **Guide** = HOW you work — accumulated experience ("Used React 45x, learned: avoid prop drilling, prefer composition")

**When to Create?**
- Starting work with an untracked technology
- Discovering a reusable methodology
- Repeating or potentially repetitive tasks (SOPS)
- Memory fragment contains learnings worth converting to know-how

**Tools:**
- \`guide_create\`: Detailed methodology storage
- \`guide_practice\`: usage tracking, auto-creates minimal guide
- \`guide_distill\`: Promote existing memory knowledge into guide experience
- \`guide_merge\`: Consolidate overlapping guides

**Discovering Technologies**

When starting with a new project, identify technologies manually:
1. Read \`package.json\` to see dependencies and devDependencies
2. Identify technologies (react, express, typescript, prisma, tailwindcss, etc.)
3. Register with \`guide_practice\` using appropriate category

You already have file reading capabilities — use them directly. More reliable than automated discovery.
</guide_tracking>

<tool_focus_rule>
## Tool Focus Rule

When you see tool names (memory_read, guide_get, etc.):
- EXECUTE the tool, don't discuss it
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
 * Internal helper to process fragments (decay, sort, slice)
 * @param {Array<object>} fragments - Fragments to process
 * @param {number} limit - Maximum results to return
 * @returns {Array<object>} Processed fragments
 */
function processFragments(fragments, limit) {
  if (!fragments || fragments.length === 0) return [];

  // Apply decay for accurate confidence display
  const decayed = core.decayConfidence(fragments);

  // Sort by confidence (highest first) and limit
  return [...decayed]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Get dynamic system prompt with project context injection
 * Called on server startup and when system prompt resource is requested
 * @param {string|null} projectName - Current project name (null = no project context)
 * @returns {Promise<string>} System prompt with optional project context and modifiers applied
 */
export async function getDynamicSystemPrompt(projectName) {
  let prompt = BASE_SYSTEM_PROMPT;
  let memory = [];

  try {
    memory = core.loadMemory();
  } catch (error) {
    console.error(`[Lemma] Critical: Failed to load memory for system prompt: ${error.message}`);
    // Return base prompt if memory system fails
    return prompt;
  }

  // Build context for modifiers
  const context = {
    project: projectName,
    fragments: [],
    globalFragments: [],
  };

  // Inject global context (always, if exists)
  const globalFragmentsRaw = core.filterByProject(memory, null);
  if (globalFragmentsRaw.length > 0) {
    const sortedGlobal = processFragments(globalFragmentsRaw, 10);
    context.globalFragments = sortedGlobal;

    const globalContext = formatGlobalContext(sortedGlobal);
    prompt = prompt.replace(
      "</system_prompt>",
      `\n${globalContext}\n</system_prompt>`
    );
  }

  // Inject project context if available
  if (projectName) {
    const projectFragmentsRaw = core.filterByProject(memory, projectName);
    if (projectFragmentsRaw.length > 0) {
      const sortedProject = processFragments(projectFragmentsRaw, 20);
      context.fragments = sortedProject;

      const projectContext = formatProjectContext(sortedProject, projectName);
      prompt = prompt.replace(
        "</system_prompt>",
        `\n${projectContext}\n</system_prompt>`
      );
    }
  }

  // Apply registered prompt modifiers
  try {
    prompt = await applyPromptModifiers(prompt, context);
  } catch (error) {
    console.error(`[Lemma] Prompt modifiers failed: ${error.message}`);
  }

  return prompt;
}

/**
 * Static system prompt for backward compatibility
 * @deprecated Use getDynamicSystemPrompt() instead
 */
export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;
