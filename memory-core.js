// Lemma Memory Core Module
// Provides persistent memory storage with confidence decay for AI context

import os from "os";
import path from "path";
import fs from "fs";

const MEMORY_DIR = path.join(os.homedir(), ".lemma");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.jsonl");

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
 * Create a new memory fragment object
 * @param {string} fragment - The text content of the memory
 * @param {"user"|"ai"} source - Origin of the memory
 * @param {string} title - Short title for the memory (auto-generated if not provided)
 * @param {string|null} project - Project scope (null = global, string = project-specific)
 * @returns {object} Memory fragment object
 */
export function createFragment(fragment, source, title = null, project = null) {
  // Auto-generate title from first 40 chars if not provided
  const autoTitle = title || (fragment.length > 40 ? fragment.substring(0, 40) + "..." : fragment);

  const now = new Date();

  return {
    id: generateId(),
    title: autoTitle,
    fragment: fragment,
    project: project,
    confidence: 1.0,
    source: source,
    created: now.toISOString().split("T")[0],
    lastAccessed: now.toISOString(),
    accessed: 0
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
 */
export function saveMemory(fragments) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Write each fragment as a JSON line
    const jsonl = fragments.map(f => JSON.stringify(f)).join("\n");
    fs.writeFileSync(MEMORY_FILE, jsonl, "utf-8");
  } catch (error) {
    console.error("Error saving memory:", error.message);
    throw error;
  }
}

/**
 * Filter memory fragments by project scope
 * @param {Array<object>} fragments - Array of memory fragments
 * @param {string|null} currentProject - Current project name (null = no filtering)
 * @returns {Array<object>} Filtered fragments (global + current project)
 */
export function filterByProject(fragments, currentProject) {
  if (!currentProject) {
    // No project context, return only global fragments
    return fragments.filter(f => f.project === null || f.project === undefined);
  }
  // Return global fragments + current project fragments
  return fragments.filter(f =>
    f.project === null ||
    f.project === undefined ||
    f.project === currentProject
  );
}

/**
 * Apply time-based confidence decay to memory fragments
 * Decay rate decreases as access count increases, but it also considers time elapsed 
 * since last access. Even highly accessed items decay eventually if unused.
 * Removes fragments with confidence below 0.1
 * @param {Array<object>} fragments - Array of memory fragments
 * @returns {Array<object>} Filtered and decayed fragments
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

      const sessionDecay = accessDecayModifier * timeDecayMultiplier;

      const newConfidence = frag.confidence - sessionDecay;

      return {
        ...frag,
        confidence: Math.max(0, newConfidence)
      };
    })
    .filter(frag => frag.confidence >= 0.1)
    .map(frag => ({
      ...frag,
      accessed: 0 // Reset access counter for the next session
    }));
}

/**
 * Execute search, semantic relevance matching and top-k truncating.
 * Updates lastAccessed parameter as a reading effect.
 * @param {Array<object>} fragments - Fetched DB fragments
 * @param {string|null} query - User search term
 * @param {number} topK - Max output window limit
 * @returns {Array<object>} Array of scored/sorted fragments
 */
export function searchAndSortFragments(fragments, query = null, topK = 30) {
  const nowDate = new Date().toISOString();

  let results = fragments.map(frag => {
    let relevance = frag.confidence * 10; // Default weight is confidence

    if (query) {
      // Bump score heavily if keywords appear in text
      const queryTokens = query.toLowerCase().split(/\s+/);
      const titleLower = frag.title.toLowerCase();
      const fragLower = frag.fragment.toLowerCase();

      let matched = false;
      for (const token of queryTokens) {
        if (titleLower.includes(token) || fragLower.includes(token)) {
          relevance += 15;
          matched = true;
        }
      }

      // Heavily penalize disjoint results if query exists but didn't match
      if (!matched) {
        relevance -= 50;
      }
    }

    return { frag, relevance };
  });

  // Exclude un-relevant search results
  if (query) {
    results = results.filter(r => r.relevance >= 0);
  }

  // Sort descending by calculated metric
  results.sort((a, b) => b.relevance - a.relevance);

  // Truncate to top K
  const topResults = results.slice(0, topK).map(r => r.frag);

  // Mutably update their lastAccessed metrics
  topResults.forEach(frag => {
    frag.lastAccessed = nowDate;
  });

  return topResults;
}

/**
 * Format memory fragments for LLM consumption
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
    return `[${frag.id}] ${confidenceBar} (${sourceIcon}) ${scopeTag} ${frag.title}\n    ${frag.fragment}`;
  });

  return `=== LEMMA MEMORY FRAGMENTS${projectHeader} ===\n${lines.join("\n")}\n==============================`;
}
