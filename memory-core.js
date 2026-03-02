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

  return {
    id: generateId(),
    title: autoTitle,
    fragment: fragment,
    project: project,
    confidence: 1.0,
    source: source,
    created: new Date().toISOString().split("T")[0],
    accessed: 0
  };
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
 * Apply confidence decay to memory fragments
 * Decay rate decreases as access count increases (frequently accessed memories decay slower)
 * Removes fragments with confidence below 0.1
 * @param {Array<object>} fragments - Array of memory fragments
 * @returns {Array<object>} Filtered and decayed fragments
 */
export function decayConfidence(fragments) {
  return fragments
    .map(frag => {
      const decayRate = Math.max(0.0, 0.05 - (frag.accessed * 0.005));
      const newConfidence = frag.confidence - decayRate;
      return {
        ...frag,
        confidence: Math.max(0, newConfidence)
      };
    })
    .filter(frag => frag.confidence >= 0.1)
    .map(frag => ({
      ...frag,
      accessed: 0 // Reset access counter after decay
    }));
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
