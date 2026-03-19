// Lemma Guides Core Module
// Provides guide tracking with usage statistics and learnings for AI context

import os from "os";
import path from "path";
import fs from "fs";
import Fuse from "fuse.js";
import { TASK_GUIDE_MAP } from "./task-map.js";

const MEMORY_DIR = path.join(os.homedir(), ".lemma");
const GUIDES_FILE = path.join(MEMORY_DIR, "guides.jsonl");

/**
 * Generate a unique guide ID
 * @returns {string} ID in format "g" + 6 hex characters
 */
export function generateGuideId() {
  const hexChars = Math.random().toString(16).substring(2, 8);
  return `g${hexChars}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string}
 */
export function getToday() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Create a new guide object
 * @param {string} guide - Guide name (e.g., "react", "python")
 * @param {string} category - Category (must be one of VALID_CATEGORIES)
 * @param {string} description - Detailed description or manual for the guide
 * @param {string[]} contexts - Initial contexts (optional)
 * @param {string[]} learnings - Initial learnings (optional)
 * @returns {object} Guide object
 *
 * VALID CATEGORIES:
 * ─────────────────────────────────────────────────────────────
 * WEB DEVELOPMENT:
 *   web-frontend    → React, Next.js, Tailwind, HTML/CSS, WebGL
 *   web-backend     → Node.js, NestJS, FastAPI, GraphQL, tRPC
 *   data-storage    → PostgreSQL, MongoDB, Redis, Vector DB
 *   dev-tool        → Testing, CI/CD, Build tools, Git
 *
 * MOBILE DEVELOPMENT:
 *   mobile-frontend → React Native, Flutter, Expo, Swift, Kotlin
 *
 * GAME DEVELOPMENT:
 *   game-frontend   → Three.js, Canvas, WebGL, Sprite rendering
 *   game-backend    → Godot patterns, Game loop, ECS, State machines
 *   game-tool       → AI art generation, Export, Upscaling, BG removal
 *   game-design     → Pixel art, Level design, Character design, Textures
 *
 * CROSS-CUTTING:
 *   app-security    → OAuth, OWASP, Cryptography, Zero Trust
 *   ui-design       → Figma, Accessibility, Animation, Design systems
 *   infra-devops    → Docker, Kubernetes, Cloud, CI/CD pipelines
 *   programming-language → TypeScript, Python, Rust, Go, Java
 * ─────────────────────────────────────────────────────────────
 */
export function createGuide(guide, category, description = "", contexts = [], learnings = []) {
  return {
    id: generateGuideId(),
    guide: guide.toLowerCase().trim(),
    category: category.toLowerCase().trim(),
    description: description.trim(),
    usage_count: 1,
    last_used: getToday(),
    contexts: contexts.map(c => c.toLowerCase().trim()).filter(Boolean),
    learnings: learnings.map(l => l.trim()).filter(Boolean)
  };
}

/**
 * Load all guides from disk
 * @returns {Array<object>} Array of guide objects, empty if file doesn't exist
 */
export function loadGuides() {
  try {
    if (!fs.existsSync(GUIDES_FILE)) {
      return [];
    }
    const content = fs.readFileSync(GUIDES_FILE, "utf-8");
    if (!content.trim()) {
      return [];
    }
    return content
      .trim()
      .split("\n")
      .map(line => JSON.parse(line));
  } catch (error) {
    console.error("Error loading guides:", error.message);
    return [];
  }
}

/**
 * Save guides to disk as JSONL
 * @param {Array<object>} guides - Array of guide objects to save
 */
export function saveGuides(guides) {
  try {
    const dir = path.dirname(GUIDES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // SAFETY CHECK: Never save empty data - prevents accidental data loss
    if (!guides || guides.length === 0) {
      console.warn("WARNING: Attempted to save empty guides array - ABORTED to prevent data loss");
      return;
    }

    const jsonl = guides.map(g => JSON.stringify(g)).join("\n");

    // SAFETY: Backup is a cumulative archive — never removes entries
    // Merge: backup keeps UNION of old backup entries + new entries (by ID)
    const backupFile = GUIDES_FILE + ".bak";
    if (fs.existsSync(backupFile)) {
      try {
        const backupContent = fs.readFileSync(backupFile, "utf-8");
        const backupEntries = backupContent.trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
        const backupIds = new Set(backupEntries.map(e => e.id));
        // Add any new entries not already in backup
        const newEntries = guides.filter(g => !backupIds.has(g.id));
        if (newEntries.length > 0) {
          const merged = [...backupEntries, ...newEntries];
          fs.writeFileSync(backupFile, merged.map(g => JSON.stringify(g)).join("\n"), "utf-8");
        }
        // If no new entries, backup stays untouched
      } catch {
        // Backup corrupt — overwrite with current data
        fs.writeFileSync(backupFile, jsonl, "utf-8");
      }
    } else {
      // No backup yet — create it
      fs.writeFileSync(backupFile, jsonl, "utf-8");
    }

    // Always write main file
    fs.writeFileSync(GUIDES_FILE, jsonl, "utf-8");
  } catch (error) {
    console.error("Error saving guides:", error.message);
    throw error;
  }
}

/**
 * Promote information from a memory fragment into a guide's learnings
 * @param {Array<object>} guides - Array of guide objects
 * @param {string} guideName - Target guide name
 * @param {string} category - Guide category (if new)
 * @param {string} knowledge - The text to add as a learning
 * @param {string} context - Optional context of the discovery
 * @returns {object} The updated/created guide
 */
export function promoteToGuide(guides, guideName, category, knowledge, context = "") {
  let guide = findGuide(guides, guideName);

  if (!guide) {
    guide = createGuide(guideName, category, `Created via distillation from memory.`, [context], [knowledge]);
    guides.push(guide);
  } else {
    // Add to learnings if not already present
    if (!guide.learnings.includes(knowledge)) {
      guide.learnings.push(knowledge);
    }
    // Add to contexts if provided and not present
    if (context && !guide.contexts.includes(context)) {
      guide.contexts.push(context.toLowerCase().trim());
    }
    guide.usage_count += 1; // Distillation counts as a "practice" of the knowledge
    guide.last_used = getToday();
  }

  return guide;
}

/**
 * Find a guide by name (case-insensitive)
 * @param {Array<object>} guides - Array of guide objects
 * @param {string} guideName - Guide name to find
 * @returns {object|null} Guide object or null if not found
 */
export function findGuide(guides, guideName) {
  const normalized = guideName.toLowerCase().trim();
  return guides.find(g => g.guide === normalized) || null;
}

/**
 * Update an existing guide's basic fields (id, guide, category, description)
 * @param {Array<object>} guides - Array of guide objects
 * @param {string} guideName - Name of the guide to update
 * @param {object} updates - Fields to update
 * @returns {object|null} Updated guide or null if not found
 */
export function updateGuide(guides, guideName, updates) {
  const guide = findGuide(guides, guideName);
  if (!guide) return null;

  if (updates.guide) guide.guide = updates.guide.toLowerCase().trim();
  if (updates.category) guide.category = updates.category.toLowerCase().trim();
  if (updates.description) guide.description = updates.description.trim();

  return guide;
}

/**
 * Delete a guide by name
 * @param {Array<object>} guides - Array of guide objects
 * @param {string} guideName - Name of the guide to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteGuide(guides, guideName) {
  const normalized = guideName.toLowerCase().trim();
  const initialLength = guides.length;
  const filtered = guides.filter(g => g.guide !== normalized);

  if (filtered.length === initialLength) return false;

  // Update the array in place (since it's passed by reference in some contexts)
  guides.length = 0;
  guides.push(...filtered);
  return true;
}

/**
 * Practice (use) a guide - increment usage, update contexts/learnings
 * @param {Array<object>} guides - Array of guide objects (will be mutated)
 * @param {string} guideName - Guide name
 * @param {string} category - Category (only used if creating new)
 * @param {string} description - Description (only used if creating new or updating empty)
 * @param {string[]} newContexts - Additional contexts to add
 * @param {string[]} newLearnings - Additional learnings to add
 * @returns {object} The updated or created guide
 */
export function practiceGuide(guides, guideName, category, description = "", newContexts = [], newLearnings = []) {
  let guide = findGuide(guides, guideName);

  if (!guide) {
    // Create new guide
    guide = createGuide(guideName, category, description, newContexts, newLearnings);
    guides.push(guide);
    return guide;
  }

  // Update existing guide
  guide.usage_count += 1;
  guide.last_used = getToday();

  // Update description if it was empty and new one is provided
  if (!guide.description && description) {
    guide.description = description.trim();
  }

  // Merge new contexts (deduplicated, case-insensitive)
  const existingContexts = new Set(guide.contexts.map(c => c.toLowerCase()));
  for (const ctx of newContexts) {
    const normalized = ctx.toLowerCase().trim();
    if (normalized && !existingContexts.has(normalized)) {
      guide.contexts.push(normalized);
      existingContexts.add(normalized);
    }
  }

  // Merge new learnings (deduplicated by exact match)
  const existingLearnings = new Set(guide.learnings);
  for (const learning of newLearnings) {
    const trimmed = learning.trim();
    if (trimmed && !existingLearnings.has(trimmed)) {
      guide.learnings.push(trimmed);
      existingLearnings.add(trimmed);
    }
  }

  return guide;
}

/**
 * Get guides sorted by usage (most used first)
 * @param {Array<object>} guides - Array of guide objects
 * @param {number} limit - Max number to return
 * @returns {Array<object>} Sorted guides
 */
export function getTopGuides(guides, limit = 20) {
  return [...guides]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, limit);
}

/**
 * Get guides filtered by category
 * @param {Array<object>} guides - Array of guide objects
 * @param {string} category - Category to filter by
 * @returns {Array<object>} Filtered guides
 */
export function getGuidesByCategory(guides, category) {
  const normalized = category.toLowerCase().trim();
  return guides.filter(g => g.category === normalized);
}

/**
 * Format guides for LLM consumption
 * @param {Array<object>} guides - Array of guide objects
 * @returns {string} Formatted string
 */
export function formatGuidesForLLM(guides) {
  if (guides.length === 0) {
    return `=== LEMMA GUIDES ===\n(no guides tracked yet)\n====================`;
  }

  const sorted = getTopGuides(guides, 30);

  const lines = sorted.map(guide => {
    const contextsStr = guide.contexts.length > 0
      ? ` [${guide.contexts.slice(0, 5).join(", ")}${guide.contexts.length > 5 ? "..." : ""}]`
      : "";
    const learningsCount = guide.learnings.length > 0
      ? ` (${guide.learnings.length} learnings)`
      : "";
    return `[${guide.category}] ${guide.guide}: ${guide.usage_count}x (last: ${guide.last_used})${contextsStr}${learningsCount}`;
  });

  return `=== LEMMA GUIDES ===\n${lines.join("\n")}\n====================`;
}

/**
 * Tokenize a string into words for matching
 * @param {string} str - String to tokenize
 * @returns {Set<string>} Set of lowercase tokens
 */
function tokenize(str) {
  if (!str) return new Set();
  // Split by spaces, hyphens, underscores, and common separators
  const tokens = str.toLowerCase()
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2); // Ignore single-char tokens
  return new Set(tokens);
}

/**
 * Check if any token from text matches any token from target
 * Uses partial matching: "viral" matches "viral-content"
 * @param {string} text - Source text (e.g., task description)
 * @param {string} target - Target text (e.g., guide name or context)
 * @returns {boolean} True if there's a token overlap
 */
function hasTokenMatch(text, target) {
  const textTokens = tokenize(text);
  const targetTokens = tokenize(target);

  // Check for exact token match
  for (const token of textTokens) {
    if (targetTokens.has(token)) return true;
  }

  // Check for partial match (token contained in target token or vice versa)
  for (const textToken of textTokens) {
    for (const targetToken of targetTokens) {
      if (textToken.includes(targetToken) || targetToken.includes(textToken)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Suggest guides based on task description using fuzzy search
 * @param {string} taskDescription - Task/query description
 * @param {Array<object>} existingGuides - Current tracked guides
 * @returns {object} { suggested: [], missing: [], relevant: [] }
 */
export function suggestGuides(taskDescription, existingGuides = []) {
  const suggestions = [];
  const seen = new Set();

  // Fuse.js configuration for guide matching
  const fuseOptions = {
    keys: ['guide', 'keywords', 'contexts', 'learnings', 'description'],
    threshold: 0.45,           // Tolerate typos and partial matches
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true
  };

  // 1. Search in TASK_GUIDE_MAP using Fuse
  const allGuideDefs = Object.values(TASK_GUIDE_MAP).flat().map(def => ({
    ...def,
    keywords: def.keywords || []
  }));

  const staticFuse = new Fuse(allGuideDefs, {
    ...fuseOptions,
    keys: ['guide', 'keywords']
  });

  const staticResults = staticFuse.search(taskDescription, { limit: 20 });

  for (const result of staticResults) {
    const guideDef = result.item;
    if (seen.has(guideDef.guide)) continue;
    seen.add(guideDef.guide);

    const existing = existingGuides.find(g => g.guide === guideDef.guide);
    suggestions.push({
      ...guideDef,
      tracked: !!existing,
      usage_count: existing?.usage_count || 0,
      last_used: existing?.last_used || null,
      learnings: existing?.learnings || [],
      contexts: existing?.contexts || [],
    });
  }

  // 2. Search in tracked guides using Fuse (fuzzy on name, contexts, learnings, description)
  if (existingGuides.length > 0) {
    const trackedFuse = new Fuse(existingGuides, {
      ...fuseOptions,
      keys: ['guide', 'contexts', 'learnings', 'description']
    });

    const trackedResults = trackedFuse.search(taskDescription, { limit: 20 });

    for (const result of trackedResults) {
      const existing = result.item;
      if (seen.has(existing.guide)) continue;
      seen.add(existing.guide);

      suggestions.push({
        guide: existing.guide,
        category: existing.category,
        keywords: existing.contexts,
        tracked: true,
        usage_count: existing.usage_count,
        last_used: existing.last_used,
        learnings: existing.learnings,
        contexts: existing.contexts,
        description: existing.description,
      });
    }
  }

  // 3. Fallback: token-based matching for anything Fuse might have missed
  const desc = taskDescription.toLowerCase();
  for (const existing of existingGuides) {
    if (seen.has(existing.guide)) continue;

    // Token-based fallback
    if (hasTokenMatch(desc, existing.guide) ||
      existing.contexts.some(ctx => hasTokenMatch(desc, ctx)) ||
      existing.learnings.some(l => hasTokenMatch(desc, l))) {
      seen.add(existing.guide);
      suggestions.push({
        guide: existing.guide,
        category: existing.category,
        keywords: existing.contexts,
        tracked: true,
        usage_count: existing.usage_count,
        last_used: existing.last_used,
        learnings: existing.learnings,
        contexts: existing.contexts,
        description: existing.description,
      });
    }
  }

  // Separate into categories
  const tracked = suggestions.filter(s => s.tracked);
  const missing = suggestions.filter(s => !s.tracked);

  return {
    relevant: tracked,
    missing: missing,
    suggested: suggestions,
    summary: `Found ${suggestions.length} relevant guides (${tracked.length} tracked, ${missing.length} new)`,
  };
}

/**
 * Format guide suggestions for LLM
 * @param {object} result - Result from suggestGuides
 * @returns {string} Formatted string
 */
export function formatSuggestions(result) {
  let output = `=== GUIDE SUGGESTIONS ===\n`;
  output += `${result.summary}\n\n`;

  if (result.relevant.length > 0) {
    output += `TRACKED (you have experience):\n`;
    for (const s of result.relevant) {
      output += `  ✓ [${s.category}] ${s.guide} (${s.usage_count}x, last: ${s.last_used || 'n/a'})\n`;
      // Show learnings if any
      if (s.learnings && s.learnings.length > 0) {
        for (const l of s.learnings.slice(0, 3)) {
          output += `      💡 ${l}\n`;
        }
        if (s.learnings.length > 3) {
          output += `      ... and ${s.learnings.length - 3} more learnings\n`;
        }
      }
    }
    output += `\n`;
  }

  if (result.missing.length > 0) {
    output += `SUGGESTED (not tracked yet):\n`;
    for (const s of result.missing) {
      output += `  + [${s.category}] ${s.guide}\n`;
      // Show keywords as hints
      if (s.keywords && s.keywords.length > 0) {
        output += `      keywords: ${s.keywords.slice(0, 5).join(", ")}\n`;
      }
    }
    output += `\n`;
  }

  if (result.suggested.length === 0) {
    output += `No relevant guides found for this task.\n`;
    output += `Try describing the task with more specific terms.\n`;
  }

  output += `========================`;
  return output;
}

/**
 * Format a single guide detail for LLM
 * @param {object} guide - Guide object
 * @returns {string} Formatted detail string
 */
export function formatGuideDetail(guide) {
  if (!guide) {
    return "Guide not found.";
  }

  let detail = `=== GUIDE: ${guide.guide} ===\n`;
  detail += `Category: ${guide.category}\n`;
  detail += `Usage Count: ${guide.usage_count}\n`;
  detail += `Last Used: ${guide.last_used}\n`;

  if (guide.description) {
    detail += `\n=== DESCRIPTION / PROTOCOLS ===\n${guide.description}\n===============================\n`;
  }

  if (guide.contexts.length > 0) {
    detail += `Contexts: ${guide.contexts.join(", ")}\n`;
  }

  if (guide.learnings.length > 0) {
    detail += `Learnings:\n`;
    for (const l of guide.learnings) {
      detail += `  - ${l}\n`;
    }
  }

  detail += `====================`;
  return detail;
}

// Export TASK_GUIDE_MAP for external use
export { TASK_GUIDE_MAP };
