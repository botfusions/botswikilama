// Lemma Memory Core Module
// Provides persistent memory storage with confidence decay for AI context

import os from "os";
import path from "path";
import fs from "fs";
import Fuse from "fuse.js";

let MEMORY_DIR = path.join(os.homedir(), ".lemma");
let MEMORY_FILE = path.join(MEMORY_DIR, "memory.jsonl");

/**
 * Override memory directory for testing or custom storage.
 * @param {string} dir - New directory path
 */
export function setMemoryDir(dir) {
  MEMORY_DIR = dir;
  MEMORY_FILE = path.join(MEMORY_DIR, "memory.jsonl");
}

/**
 * Generate a unique memory fragment ID
 * @returns {string} ID in format "m" + 6 hex characters
 */
export function generateId() {
  const hexChars = Math.random().toString(16).substring(2, 8);
  return `m${hexChars}`;
}

/**
 * Detect current project from working directory
 * @returns {string|null} Project name or null if not in a project
 */
export function detectProject() {
  try {
    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    return projectName || null;
  } catch {
    return null;
  }
}

/**
 * Generate a short description/summary from fragment content
 * Used for LLM preview without exposing full content
 * @param {string} fragment - The full fragment text
 * @param {string} title - The title (for context)
 * @returns {string} Short description (max 120 chars)
 */
function generateDescription(fragment, title) {
  // If fragment is short enough, use it directly
  if (fragment.length <= 80) {
    return fragment;
  }

  // Try to extract key information
  // Look for patterns like "key: value" or important keywords
  const keywords = [];

  // Extract first sentence or clause
  const firstSentence = fragment.split(/[.!?\n]/)[0];
  if (firstSentence && firstSentence.length <= 100) {
    return firstSentence.trim() + (firstSentence.endsWith('.') ? '' : '...');
  }

  // Fallback: use first 80 chars
  return fragment.substring(0, 80).trim() + '...';
}

/**
 * Create a new memory fragment object
 * @param {string} fragment - The text content of the memory
 * @param {"user"|"ai"} source - Origin of the memory
 * @param {string} title - Short title for the memory (auto-generated if not provided)
 * @param {string|null} project - Project scope (null = global, string = project-specific)
 * @param {string} description - Optional short description (auto-generated if not provided)
 * @returns {object} Memory fragment object
 */
export function createFragment(fragment, source, title = null, project = null, description = null) {
  // Auto-generate title from first 40 chars if not provided
  const autoTitle = title || (fragment.length > 40 ? fragment.substring(0, 40) + "..." : fragment);

  // Auto-generate description if not provided
  const autoDescription = description || generateDescription(fragment, autoTitle);

  const now = new Date();

  return {
    id: generateId(),
    title: autoTitle,
    description: autoDescription,
    fragment: fragment,
    project: project,
    confidence: 1.0,
    source: source,
    created: now.toISOString().split("T")[0],
    lastAccessed: now.toISOString(),
    accessed: 0,
    tags: [],
    associatedWith: [],
    negativeHits: 0
  };
}

/**
 * Calculate Jaccard text similarity between two strings
 * @param {string} text1
 * @param {string} text2
 * @returns {number} Score between 0.0 and 1.0
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0.0;

  // Basic tokenization
  const getTokens = (str) => new Set(str.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean));

  const set1 = getTokens(text1);
  const set2 = getTokens(text2);

  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Look for similar existing fragments preventing duplication
 * @param {Array<object>} fragments - Memory fragments to check against
 * @param {string} fragmentText - The text trying to be added
 * @param {string|null} project - Project scope (null = global, string = project-specific)
 * @param {number} threshold - Minimum similarity score (0-1) to trigger a match
 * @returns {object|null} The most similar fragment if similarity >= threshold, otherwise null
 */
export function findSimilarFragment(fragments, fragmentText, project, threshold = 0.55) {
  const scopedFragments = filterByProject(fragments, project);
  let bestMatch = null;
  let highestScore = 0;

  for (const frag of scopedFragments) {
    const score = calculateSimilarity(frag.fragment, fragmentText);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = frag;
    }
  }

  return highestScore >= threshold ? bestMatch : null;
}

/**
 * Boost a fragment's confidence and tag it with context on access.
 * Called when a memory is actively used (not just read/decayed).
 * @param {object} fragment - Memory fragment to boost
 * @param {string|null} context - Optional context tag (e.g., "debugging", "error-handling")
 * @returns {object} Updated fragment
 */
export function boostOnAccess(fragment, context = null) {
  const boosted = { ...fragment };
  boosted.confidence = Math.min(1.0, boosted.confidence + 0.1);
  boosted.accessed++;
  boosted.lastAccessed = new Date().toISOString();

  if (context && typeof context === "string") {
    const tags = boosted.tags || [];
    const newTag = context.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      boosted.tags = [...tags, newTag];
    }
  }

  return boosted;
}

/**
 * Record a negative signal for a fragment (it was accessed but wasn't useful).
 * Reduces confidence and increments negative hit counter.
 * @param {object} fragment - Memory fragment to penalize
 * @returns {object} Updated fragment
 */
export function recordNegativeHit(fragment) {
  return {
    ...fragment,
    confidence: Math.max(0, fragment.confidence - 0.1),
    negativeHits: (fragment.negativeHits || 0) + 1,
    lastAccessed: new Date().toISOString()
  };
}

/**
 * Track associations between fragments accessed in the same session.
 * Mutates fragments in place to add cross-references.
 * @param {Array<object>} fragments - All memory fragments
 * @param {string} accessedId - The ID of the fragment being accessed
 * @param {Array<string>} sessionIds - IDs of other fragments accessed in the same session
 */
export function trackAssociations(fragments, accessedId, sessionIds) {
  if (!sessionIds || sessionIds.length === 0) return;

  const target = fragments.find(f => f.id === accessedId);
  if (!target) return;

  const existing = new Set(target.associatedWith || []);
  for (const id of sessionIds) {
    if (id !== accessedId && !existing.has(id)) {
      existing.add(id);
      // Also add reverse association
      const other = fragments.find(f => f.id === id);
      if (other) {
        const otherAssoc = new Set(other.associatedWith || []);
        otherAssoc.add(accessedId);
        other.associatedWith = [...otherAssoc];
      }
    }
  }
  target.associatedWith = [...existing];
}

/**
 * Load all memory fragments from disk
 * @returns {Array<object>} Array of memory fragments, empty if file doesn't exist
 */
export function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return [];
    }
    const content = fs.readFileSync(MEMORY_FILE, "utf-8");
    if (!content.trim()) {
      return [];
    }
    return content
      .trim()
      .split("\n")
      .map(line => JSON.parse(line));
  } catch (error) {
    console.error("Error loading memory:", error.message);
    return [];
  }
}

/**
 * Save memory fragments to disk as JSONL
 * @param {Array<object>} fragments - Array of memory fragments to save
 * @param {object} options - Options
 * @param {boolean} options.force - If true, allow saving empty array (for intentional deletion)
 */
export function saveMemory(fragments, options = {}) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // SAFETY CHECK: Never save empty data unless forced
    if ((!fragments || fragments.length === 0) && !options.force) {
      console.warn("WARNING: Attempted to save empty memory array - ABORTED to prevent data loss");
      return;
    }

    // Write each fragment as a JSON line
    const jsonl = fragments && fragments.length > 0 ? fragments.map(f => JSON.stringify(f)).join("\n") : "";

    // SAFETY: Backup is a cumulative archive — never removes entries
    // Merge: backup keeps UNION of old backup entries + new entries (by ID)
    const backupFile = MEMORY_FILE + ".bak";
    if (fs.existsSync(backupFile)) {
      try {
        const backupContent = fs.readFileSync(backupFile, "utf-8");
        const backupEntries = backupContent.trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
        const backupIds = new Set(backupEntries.map(e => e.id));
        // Add any new entries not already in backup
        const newEntries = fragments.filter(f => !backupIds.has(f.id));
        if (newEntries.length > 0) {
          const merged = [...backupEntries, ...newEntries];
          fs.writeFileSync(backupFile, merged.map(f => JSON.stringify(f)).join("\n"), "utf-8");
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
    fs.writeFileSync(MEMORY_FILE, jsonl, "utf-8");
  } catch (error) {
    console.error("Error saving memory:", error.message);
    throw error;
  }
}

/**
 * Filter memory fragments by project scope (STRICT ISOLATION)
 * @param {Array<object>} fragments - Array of memory fragments
 * @param {string|null} currentProject - Current project name (null = global only)
 * @returns {Array<object>} Filtered fragments (strict project isolation)
 */
export function filterByProject(fragments, currentProject) {
  // Normalize: treat empty string, whitespace-only, "null", "undefined" as null
  const project = (typeof currentProject === 'string')
    ? currentProject.trim() || null
    : null;

  if (!project) {
    // No project context, return only global fragments
    return fragments.filter(f => f.project === null || f.project === undefined);
  }
  // STRICT: Return ONLY the specified project's fragments (not global)
  return fragments.filter(f => f.project === project);
}

/**
 * Apply time-based confidence decay to memory fragments
 * Decay rate decreases as access count increases, but it also considers time elapsed
 * since last access. Even highly accessed items decay eventually if unused.
 * IMPORTANT: Never removes fragments — only reduces confidence scores.
 * Removal is handled exclusively by memory_forget.
 * @param {Array<object>} fragments - Array of memory fragments
 * @returns {Array<object>} Decayed fragments (same count, never fewer)
 */
export function decayConfidence(fragments) {
  const now = new Date();

  return fragments
    .map(frag => {
      // Compatibility fallback for older un-migrated memories
      const lastAccessed = frag.lastAccessed ? new Date(frag.lastAccessed) : new Date(frag.created);

      // Calculate days since last access
      const daysSinceAccess = Math.max(0, (now - lastAccessed) / (1000 * 60 * 60 * 24));

      // Base decay: lose 0.05 confidence per "session" (decay cycle)
      // High access reduces decay magnitude
      let accessDecayModifier = Math.max(0.005, 0.05 - (frag.accessed * 0.005));

      // Time decay multiplier: if the memory hasn't been accessed in weeks, increase penalty
      // (1 + days factor ensures old items decay even if they were accessed heavily before)
      const timeDecayMultiplier = 1 + (daysSinceAccess * 0.05);

      // Negative hit multiplier: fragments that were frequently unhelpful decay faster
      const negativeHitMultiplier = 1 + ((frag.negativeHits || 0) * 0.2);

      const sessionDecay = accessDecayModifier * timeDecayMultiplier * negativeHitMultiplier;

      const newConfidence = frag.confidence - sessionDecay;

      return {
        ...frag,
        confidence: Math.max(0, newConfidence),
        accessed: 0, // Reset access counter for the next session
        negativeHits: 0 // Reset negative hits each session
      };
    });
}

/**
 * Execute fuzzy search using Fuse.js with typo tolerance and partial matching.
 * Falls back to confidence-based sorting when no query.
 * Updates lastAccessed parameter as a reading effect.
 * @param {Array<object>} fragments - Fetched DB fragments
 * @param {string|null} query - User search term
 * @param {number} topK - Max output window limit
 * @returns {Array<object>} Array of scored/sorted fragments
 */
export function searchAndSortFragments(fragments, query = null, topK = 30) {
  const nowDate = new Date().toISOString();

  // No query: sort by confidence only
  if (!query) {
    const sorted = [...fragments]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);

    sorted.forEach(frag => { frag.lastAccessed = nowDate; });
    return sorted;
  }

  // Fuse.js configuration for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'fragment', weight: 0.6 }
    ],
    threshold: 0.3,           // Lower = stricter (0.0 = exact, 1.0 = match all)
    distance: 100,            // Max character distance for fuzzy match
    minMatchCharLength: 2,    // Minimum characters that must match
    includeScore: true,
    ignoreLocation: true,     // Search anywhere in string
    findAllMatches: true
  };

  const fuse = new Fuse(fragments, fuseOptions);
  const fuseResults = fuse.search(query, { limit: topK });

  // If Fuse finds results, use them
  if (fuseResults.length > 0) {
    const topResults = fuseResults.map(r => r.item);

    // Boost by confidence for final ranking within fuzzy results
    topResults.sort((a, b) => b.confidence - a.confidence);

    topResults.forEach(frag => { frag.lastAccessed = nowDate; });
    return topResults;
  }

  // Fallback: confidence-based if no fuzzy matches
  const fallback = [...fragments]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topK);

  fallback.forEach(frag => { frag.lastAccessed = nowDate; });
  return fallback;
}

/**
 * Format memory fragments for LLM consumption (SUMMARY MODE)
 * Shows only title + description, not full fragment content
 * LLM can request full detail via memory_read with specific ID
 * @param {Array<object>} fragments - Array of memory fragments
 * @param {string|null} currentProject - Current project name for header
 * @returns {string} Formatted string with confidence bars
 */
export function formatMemoryForLLM(fragments, currentProject = null) {
  const projectHeader = currentProject ? ` (project: ${currentProject})` : "";

  if (fragments.length === 0) {
    return `=== LEMMA MEMORY FRAGMENTS${projectHeader} ===\n(no active fragments)\n==============================`;
  }

  const lines = fragments.map(frag => {
    const barCount = Math.round(frag.confidence / 0.2);
    const confidenceBar = "█".repeat(barCount) + "░".repeat(5 - barCount);
    const sourceIcon = frag.source === "ai" ? "🤖" : "👤";
    const scopeTag = frag.project ? `[${frag.project}]` : "[global]";

    // Use description (summary) instead of full fragment
    const summary = frag.description || frag.title;

    return `[${frag.id}] ${confidenceBar} (${sourceIcon}) ${scopeTag} ${frag.title}\n    ${summary}`;
  });

  return `=== LEMMA MEMORY FRAGMENTS${projectHeader} ===\n${lines.join("\n")}\n==============================`;
}

/**
 * Format a single memory fragment with FULL DETAIL for LLM
 * Use this when LLM needs to see the complete content
 * @param {object} fragment - Single memory fragment
 * @returns {string} Formatted detail string
 */
export function formatMemoryDetail(fragment) {
  if (!fragment) {
    return "Fragment not found.";
  }

  const barCount = Math.round(fragment.confidence / 0.2);
  const confidenceBar = "█".repeat(barCount) + "░".repeat(5 - barCount);
  const sourceIcon = fragment.source === "ai" ? "🤖" : "👤";
  const scopeTag = fragment.project ? `[${fragment.project}]` : "[global]";

  let detail = `=== MEMORY FRAGMENT DETAIL ===\n`;
  detail += `ID: [${fragment.id}] ${confidenceBar} (${sourceIcon}) ${scopeTag}\n`;
  detail += `Title: ${fragment.title}\n`;
  if (fragment.description && fragment.description !== fragment.title) {
    detail += `Summary: ${fragment.description}\n`;
  }
  detail += `Created: ${fragment.created} | Confidence: ${fragment.confidence.toFixed(2)}\n`;
  if (fragment.tags && fragment.tags.length > 0) {
    detail += `Tags: ${fragment.tags.join(", ")}\n`;
  }
  if (fragment.associatedWith && fragment.associatedWith.length > 0) {
    detail += `Related: ${fragment.associatedWith.join(", ")}\n`;
  }
  detail += `--- CONTENT ---\n${fragment.fragment}\n==============`;

  return detail;
}
