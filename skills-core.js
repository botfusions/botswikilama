// Lemma Skills Core Module
// Provides skill tracking with usage statistics and learnings for AI context

import os from "os";
import path from "path";
import fs from "fs";
import Fuse from "fuse.js";

const MEMORY_DIR = path.join(os.homedir(), ".lemma");
const SKILLS_FILE = path.join(MEMORY_DIR, "skills.jsonl");

/**
 * Generate a unique skill ID
 * @returns {string} ID in format "s" + 6 hex characters
 */
export function generateSkillId() {
  const hexChars = Math.random().toString(16).substring(2, 8);
  return `s${hexChars}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string}
 */
function getToday() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Create a new skill object
 * @param {string} skill - Skill name (e.g., "react", "python")
 * @param {string} category - Category (must be one of VALID_CATEGORIES)
 * @param {string} description - Detailed description or manual for the skill
 * @param {string[]} contexts - Initial contexts (optional)
 * @param {string[]} learnings - Initial learnings (optional)
 * @returns {object} Skill object
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
export function createSkill(skill, category, description = "", contexts = [], learnings = []) {
  return {
    id: generateSkillId(),
    skill: skill.toLowerCase().trim(),
    category: category.toLowerCase().trim(),
    description: description.trim(),
    usage_count: 1,
    last_used: getToday(),
    contexts: contexts.map(c => c.toLowerCase().trim()).filter(Boolean),
    learnings: learnings.map(l => l.trim()).filter(Boolean)
  };
}

/**
 * Load all skills from disk
 * @returns {Array<object>} Array of skill objects, empty if file doesn't exist
 */
export function loadSkills() {
  try {
    if (!fs.existsSync(SKILLS_FILE)) {
      return [];
    }
    const content = fs.readFileSync(SKILLS_FILE, "utf-8");
    if (!content.trim()) {
      return [];
    }
    return content
      .trim()
      .split("\n")
      .map(line => JSON.parse(line));
  } catch (error) {
    console.error("Error loading skills:", error.message);
    return [];
  }
}

/**
 * Save skills to disk as JSONL
 * @param {Array<object>} skills - Array of skill objects to save
 */
export function saveSkills(skills) {
  try {
    const dir = path.dirname(SKILLS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const jsonl = skills.map(s => JSON.stringify(s)).join("\n");
    fs.writeFileSync(SKILLS_FILE, jsonl, "utf-8");
  } catch (error) {
    console.error("Error saving skills:", error.message);
    throw error;
  }
}

/**
 * Promote information from a memory fragment into a skill's learnings
 * @param {Array<object>} skills - Array of skill objects
 * @param {string} skillName - Target skill name
 * @param {string} category - Skill category (if new)
 * @param {string} knowledge - The text to add as a learning
 * @param {string} context - Optional context of the discovery
 * @returns {object} The updated/created skill
 */
export function promoteToSkill(skills, skillName, category, knowledge, context = "") {
  let skill = findSkill(skills, skillName);

  if (!skill) {
    skill = createSkill(skillName, category, `Created via distillation from memory.`, [context], [knowledge]);
    skills.push(skill);
  } else {
    // Add to learnings if not already present
    if (!skill.learnings.includes(knowledge)) {
      skill.learnings.push(knowledge);
    }
    // Add to contexts if provided and not present
    if (context && !skill.contexts.includes(context)) {
      skill.contexts.push(context.toLowerCase().trim());
    }
    skill.usage_count += 1; // Distillation counts as a "practice" of the knowledge
    skill.last_used = getToday();
  }

  return skill;
}

/**
 * Find a skill by name (case-insensitive)
 * @param {Array<object>} skills - Array of skill objects
 * @param {string} skillName - Skill name to find
 * @returns {object|null} Skill object or null if not found
 */
export function findSkill(skills, skillName) {
  const normalized = skillName.toLowerCase().trim();
  return skills.find(s => s.skill === normalized) || null;
}

/**
 * Update an existing skill's basic fields (id, skill, category, description)
 * @param {Array<object>} skills - Array of skill objects
 * @param {string} skillName - Name of the skill to update
 * @param {object} updates - Fields to update
 * @returns {object|null} Updated skill or null if not found
 */
export function updateSkill(skills, skillName, updates) {
  const skill = findSkill(skills, skillName);
  if (!skill) return null;

  if (updates.skill) skill.skill = updates.skill.toLowerCase().trim();
  if (updates.category) skill.category = updates.category.toLowerCase().trim();
  if (updates.description) skill.description = updates.description.trim();

  return skill;
}

/**
 * Delete a skill by name
 * @param {Array<object>} skills - Array of skill objects
 * @param {string} skillName - Name of the skill to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteSkill(skills, skillName) {
  const normalized = skillName.toLowerCase().trim();
  const initialLength = skills.length;
  const filtered = skills.filter(s => s.skill !== normalized);

  if (filtered.length === initialLength) return false;

  // Update the array in place (since it's passed by reference in some contexts)
  skills.length = 0;
  skills.push(...filtered);
  return true;
}

/**
 * Practice (use) a skill - increment usage, update contexts/learnings
 * @param {Array<object>} skills - Array of skill objects (will be mutated)
 * @param {string} skillName - Skill name
 * @param {string} category - Category (only used if creating new)
 * @param {string} description - Description (only used if creating new or updating empty)
 * @param {string[]} newContexts - Additional contexts to add
 * @param {string[]} newLearnings - Additional learnings to add
 * @returns {object} The updated or created skill
 */
export function practiceSkill(skills, skillName, category, description = "", newContexts = [], newLearnings = []) {
  let skill = findSkill(skills, skillName);

  if (!skill) {
    // Create new skill
    skill = createSkill(skillName, category, description, newContexts, newLearnings);
    skills.push(skill);
    return skill;
  }

  // Update existing skill
  skill.usage_count += 1;
  skill.last_used = getToday();

  // Update description if it was empty and new one is provided
  if (!skill.description && description) {
    skill.description = description.trim();
  }

  // Merge new contexts (deduplicated, case-insensitive)
  const existingContexts = new Set(skill.contexts.map(c => c.toLowerCase()));
  for (const ctx of newContexts) {
    const normalized = ctx.toLowerCase().trim();
    if (normalized && !existingContexts.has(normalized)) {
      skill.contexts.push(normalized);
      existingContexts.add(normalized);
    }
  }

  // Merge new learnings (deduplicated by exact match)
  const existingLearnings = new Set(skill.learnings);
  for (const learning of newLearnings) {
    const trimmed = learning.trim();
    if (trimmed && !existingLearnings.has(trimmed)) {
      skill.learnings.push(trimmed);
      existingLearnings.add(trimmed);
    }
  }

  return skill;
}

/**
 * Get skills sorted by usage (most used first)
 * @param {Array<object>} skills - Array of skill objects
 * @param {number} limit - Max number to return
 * @returns {Array<object>} Sorted skills
 */
export function getTopSkills(skills, limit = 20) {
  return [...skills]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, limit);
}

/**
 * Get skills filtered by category
 * @param {Array<object>} skills - Array of skill objects
 * @param {string} category - Category to filter by
 * @returns {Array<object>} Filtered skills
 */
export function getSkillsByCategory(skills, category) {
  const normalized = category.toLowerCase().trim();
  return skills.filter(s => s.category === normalized);
}

/**
 * Format skills for LLM consumption
 * @param {Array<object>} skills - Array of skill objects
 * @returns {string} Formatted string
 */
export function formatSkillsForLLM(skills) {
  if (skills.length === 0) {
    return `=== LEMMA SKILLS ===\n(no skills tracked yet)\n====================`;
  }

  const sorted = getTopSkills(skills, 30);

  const lines = sorted.map(skill => {
    const contextsStr = skill.contexts.length > 0
      ? ` [${skill.contexts.slice(0, 5).join(", ")}${skill.contexts.length > 5 ? "..." : ""}]`
      : "";
    const learningsCount = skill.learnings.length > 0
      ? ` (${skill.learnings.length} learnings)`
      : "";
    return `[${skill.category}] ${skill.skill}: ${skill.usage_count}x (last: ${skill.last_used})${contextsStr}${learningsCount}`;
  });

  return `=== LEMMA SKILLS ===\n${lines.join("\n")}\n====================`;
}

/**
 * Skill database for task-based suggestions
 * Maps task keywords to relevant skills
 *
 * CATEGORY SYSTEM:
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
const TASK_SKILL_MAP = {
  // ═══════════════════════════════════════════════════════════
  // WEB FRONTEND (React, Next.js, Tailwind, etc.)
  // ═══════════════════════════════════════════════════════════
  "web-frontend": [
    { skill: "html", category: "web-frontend", keywords: ["web", "sayfa", "ui", "arayüz", "html"] },
    { skill: "css", category: "web-frontend", keywords: ["stil", "style", "tasarım", "design", "css"] },
    { skill: "javascript", category: "programming-language", keywords: ["js", "web", "frontend"] },
    { skill: "react", category: "web-frontend", keywords: ["component", "jsx", "hook", "state", "react"] },
    { skill: "vue", category: "web-frontend", keywords: ["vue", "component", "template"] },
    { skill: "angular", category: "web-frontend", keywords: ["angular", "component", "service"] },
    { skill: "tailwind", category: "web-frontend", keywords: ["tailwind", "css", "utility"] },
    { skill: "nextjs", category: "web-frontend", keywords: ["next", "nextjs", "ssr", "app router"] },
    { skill: "typescript", category: "programming-language", keywords: ["ts", "tip", "type", "interface"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // WEB BACKEND (Node.js, NestJS, FastAPI, etc.)
  // ═══════════════════════════════════════════════════════════
  "web-backend": [
    { skill: "nodejs", category: "web-backend", keywords: ["node", "server", "api", "express"] },
    { skill: "express", category: "web-backend", keywords: ["express", "router", "middleware"] },
    { skill: "nestjs", category: "web-backend", keywords: ["nestjs", "module", "controller", "service"] },
    { skill: "python", category: "programming-language", keywords: ["py", "django", "flask", "fastapi"] },
    { skill: "fastapi", category: "web-backend", keywords: ["fastapi", "async", "python"] },
    { skill: "django", category: "web-backend", keywords: ["django", "orm", "python"] },
    { skill: "rest", category: "web-backend", keywords: ["api", "rest", "endpoint", "http"] },
    { skill: "graphql", category: "web-backend", keywords: ["graphql", "query", "mutation", "schema"] },
    { skill: "trpc", category: "web-backend", keywords: ["trpc", "typescript", "rpc"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // DATA STORAGE (Databases, Caches, Vector DBs)
  // ═══════════════════════════════════════════════════════════
  "data-storage": [
    { skill: "postgresql", category: "data-storage", keywords: ["postgres", "sql", "relational", "pg"] },
    { skill: "mongodb", category: "data-storage", keywords: ["mongo", "nosql", "document"] },
    { skill: "redis", category: "data-storage", keywords: ["redis", "cache", "key-value"] },
    { skill: "prisma", category: "data-storage", keywords: ["prisma", "orm", "schema"] },
    { skill: "sqlite", category: "data-storage", keywords: ["sqlite", "local", "embedded"] },
    { skill: "supabase", category: "data-storage", keywords: ["supabase", "postgres", "auth", "storage"] },
    { skill: "pinecone", category: "data-storage", keywords: ["pinecone", "vector", "embedding"] },
    { skill: "elasticsearch", category: "data-storage", keywords: ["elastic", "search", "index"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // DEV TOOLS (Testing, Build, Git)
  // ═══════════════════════════════════════════════════════════
  "dev-tool": [
    { skill: "git", category: "dev-tool", keywords: ["git", "commit", "branch", "merge"] },
    { skill: "docker", category: "infra-devops", keywords: ["docker", "container", "image"] },
    { skill: "webpack", category: "dev-tool", keywords: ["webpack", "bundle", "build"] },
    { skill: "vite", category: "dev-tool", keywords: ["vite", "build", "dev", "hmr"] },
    { skill: "jest", category: "dev-tool", keywords: ["jest", "test", "unit", "spec"] },
    { skill: "vitest", category: "dev-tool", keywords: ["vitest", "test", "vite"] },
    { skill: "playwright", category: "dev-tool", keywords: ["playwright", "e2e", "browser", "test"] },
    { skill: "eslint", category: "dev-tool", keywords: ["eslint", "lint", "format"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // MOBILE FRONTEND (React Native, Flutter, etc.)
  // ═══════════════════════════════════════════════════════════
  "mobile-frontend": [
    { skill: "react-native", category: "mobile-frontend", keywords: ["react native", "mobile", "expo", "rn"] },
    { skill: "flutter", category: "mobile-frontend", keywords: ["flutter", "dart", "mobile", "widget"] },
    { skill: "expo", category: "mobile-frontend", keywords: ["expo", "react native", "mobile"] },
    { skill: "swift", category: "mobile-frontend", keywords: ["swift", "ios", "iphone", "swiftui"] },
    { skill: "kotlin", category: "mobile-frontend", keywords: ["kotlin", "android", "jetpack"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME FRONTEND (Three.js, Canvas, WebGL)
  // ═══════════════════════════════════════════════════════════
  "game-frontend": [
    { skill: "threejs", category: "game-frontend", keywords: ["threejs", "three.js", "webgl", "3d"] },
    { skill: "canvas", category: "game-frontend", keywords: ["canvas", "html5", "2d", "drawing"] },
    { skill: "phaser", category: "game-frontend", keywords: ["phaser", "game", "html5", "2d"] },
    { skill: "webgl", category: "game-frontend", keywords: ["webgl", "shader", "gpu", "3d"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME BACKEND (Godot, Game patterns)
  // ═══════════════════════════════════════════════════════════
  "game-backend": [
    { skill: "godot", category: "game-backend", keywords: ["godot", "gdscript", "game engine"] },
    { skill: "game-loop", category: "game-backend", keywords: ["game loop", "update", "render", "fixed timestep"] },
    { skill: "state-machine", category: "game-backend", keywords: ["state", "fsm", "transition"] },
    { skill: "ecs", category: "game-backend", keywords: ["ecs", "entity", "component", "system"] },
    { skill: "object-pooling", category: "game-backend", keywords: ["pool", "reuse", "spawn", "bullet"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME TOOLS (AI art, Export, Processing)
  // ═══════════════════════════════════════════════════════════
  "game-tool": [
    { skill: "ai-art-generation", category: "game-tool", keywords: ["ai art", "stable diffusion", "flux", "dalle"] },
    { skill: "pixel-art", category: "game-design", keywords: ["pixel", "sprite", "8bit", "16bit", "retro"] },
    { skill: "aseprite", category: "game-tool", keywords: ["aseprite", "sprite", "animation"] },
    { skill: "spritesheet", category: "game-tool", keywords: ["spritesheet", "atlas", "texture", "export"] },
    { skill: "background-removal", category: "game-tool", keywords: ["bg remove", "transparent", "cutout"] },
    { skill: "image-upscaling", category: "game-tool", keywords: ["upscale", "esrgan", "hd", "4k"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME DESIGN (Pixel art, Level design, Characters)
  // ═══════════════════════════════════════════════════════════
  "game-design": [
    { skill: "level-design", category: "game-design", keywords: ["level", "map", "blockout", "flow"] },
    { skill: "character-design", category: "game-design", keywords: ["character", "silhouette", "shape language"] },
    { skill: "texture-art", category: "game-design", keywords: ["texture", "pbr", "normal map", "material"] },
    { skill: "animation", category: "game-design", keywords: ["animation", "walk cycle", "frame", "sprite"] },
    { skill: "tileset", category: "game-design", keywords: ["tileset", "tile", "autotile", "seamless"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // APP SECURITY (Auth, OWASP, Cryptography)
  // ═══════════════════════════════════════════════════════════
  "app-security": [
    { skill: "oauth", category: "app-security", keywords: ["oauth", "auth", "login", "token"] },
    { skill: "jwt", category: "app-security", keywords: ["jwt", "token", "authentication"] },
    { skill: "owasp", category: "app-security", keywords: ["owasp", "security", "vulnerability", "xss", "sql injection"] },
    { skill: "cryptography", category: "app-security", keywords: ["crypto", "encrypt", "hash", "ssl", "tls"] },
    { skill: "clerk", category: "app-security", keywords: ["clerk", "auth", "user management"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // UI DESIGN (Figma, Accessibility, Animation)
  // ═══════════════════════════════════════════════════════════
  "ui-design": [
    { skill: "figma", category: "ui-design", keywords: ["figma", "design", "prototype", "ui"] },
    { skill: "accessibility", category: "ui-design", keywords: ["a11y", "accessibility", "wcag", "aria"] },
    { skill: "animation", category: "ui-design", keywords: ["animation", "motion", "framer motion", "css animation"] },
    { skill: "design-system", category: "ui-design", keywords: ["design system", "tokens", "components"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // INFRA & DEVOPS (Docker, K8s, Cloud)
  // ═══════════════════════════════════════════════════════════
  "infra-devops": [
    { skill: "ci-cd", category: "infra-devops", keywords: ["ci", "cd", "pipeline", "github actions"] },
    { skill: "kubernetes", category: "infra-devops", keywords: ["k8s", "kubernetes", "pod", "deployment"] },
    { skill: "aws", category: "infra-devops", keywords: ["aws", "s3", "lambda", "ec2"] },
    { skill: "vercel", category: "infra-devops", keywords: ["vercel", "deploy", "edge", "serverless"] },
    { skill: "terraform", category: "infra-devops", keywords: ["terraform", "iac", "infrastructure"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // PROGRAMMING LANGUAGES
  // ═══════════════════════════════════════════════════════════
  "programming-language": [
    { skill: "typescript", category: "programming-language", keywords: ["typescript", "ts", "type"] },
    { skill: "python", category: "programming-language", keywords: ["python", "py"] },
    { skill: "rust", category: "programming-language", keywords: ["rust", "rustlang"] },
    { skill: "golang", category: "programming-language", keywords: ["go", "golang"] },
    { skill: "java", category: "programming-language", keywords: ["java", "jvm"] },
  ],
};

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
 * @param {string} target - Target text (e.g., skill name or context)
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
 * Suggest skills based on task description using fuzzy search
 * @param {string} taskDescription - Task/query description
 * @param {Array<object>} existingSkills - Current tracked skills
 * @returns {object} { suggested: [], missing: [], relevant: [] }
 */
export function suggestSkills(taskDescription, existingSkills = []) {
  const suggestions = [];
  const seen = new Set();

  // Fuse.js configuration for skill matching
  const fuseOptions = {
    keys: ['skill', 'keywords', 'contexts', 'learnings', 'description'],
    threshold: 0.45,           // Tolerate typos and partial matches
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true
  };

  // 1. Search in TASK_SKILL_MAP using Fuse
  const allSkillDefs = Object.values(TASK_SKILL_MAP).flat().map(def => ({
    ...def,
    keywords: def.keywords || []
  }));

  const staticFuse = new Fuse(allSkillDefs, {
    ...fuseOptions,
    keys: ['skill', 'keywords']
  });

  const staticResults = staticFuse.search(taskDescription, { limit: 20 });

  for (const result of staticResults) {
    const skillDef = result.item;
    if (seen.has(skillDef.skill)) continue;
    seen.add(skillDef.skill);

    const existing = existingSkills.find(s => s.skill === skillDef.skill);
    suggestions.push({
      ...skillDef,
      tracked: !!existing,
      usage_count: existing?.usage_count || 0,
      last_used: existing?.last_used || null,
      learnings: existing?.learnings || [],
      contexts: existing?.contexts || [],
    });
  }

  // 2. Search in tracked skills using Fuse (fuzzy on name, contexts, learnings, description)
  if (existingSkills.length > 0) {
    const trackedFuse = new Fuse(existingSkills, {
      ...fuseOptions,
      keys: ['skill', 'contexts', 'learnings', 'description']
    });

    const trackedResults = trackedFuse.search(taskDescription, { limit: 20 });

    for (const result of trackedResults) {
      const existing = result.item;
      if (seen.has(existing.skill)) continue;
      seen.add(existing.skill);

      suggestions.push({
        skill: existing.skill,
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
  for (const existing of existingSkills) {
    if (seen.has(existing.skill)) continue;

    // Token-based fallback
    if (hasTokenMatch(desc, existing.skill) ||
      existing.contexts.some(ctx => hasTokenMatch(desc, ctx)) ||
      existing.learnings.some(l => hasTokenMatch(desc, l))) {
      seen.add(existing.skill);
      suggestions.push({
        skill: existing.skill,
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
    summary: `Found ${suggestions.length} relevant skills (${tracked.length} tracked, ${missing.length} new)`,
  };
}

/**
 * Format skill suggestions for LLM
 * @param {object} result - Result from suggestSkills
 * @returns {string} Formatted string
 */
export function formatSuggestions(result) {
  let output = `=== SKILL SUGGESTIONS ===\n`;
  output += `${result.summary}\n\n`;

  if (result.relevant.length > 0) {
    output += `TRACKED (you have experience):\n`;
    for (const s of result.relevant) {
      output += `  ✓ [${s.category}] ${s.skill} (${s.usage_count}x, last: ${s.last_used || 'n/a'})\n`;
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
      output += `  + [${s.category}] ${s.skill}\n`;
      // Show keywords as hints
      if (s.keywords && s.keywords.length > 0) {
        output += `      keywords: ${s.keywords.slice(0, 5).join(", ")}\n`;
      }
    }
    output += `\n`;
  }

  if (result.suggested.length === 0) {
    output += `No relevant skills found for this task.\n`;
    output += `Try describing the task with more specific terms.\n`;
  }

  output += `========================`;
  return output;
}

/**
 * Format a single skill detail for LLM
 * @param {object} skill - Skill object
 * @returns {string} Formatted detail string
 */
export function formatSkillDetail(skill) {
  if (!skill) {
    return "Skill not found.";
  }

  let detail = `=== SKILL: ${skill.skill} ===\n`;
  detail += `Category: ${skill.category}\n`;
  detail += `Usage Count: ${skill.usage_count}\n`;
  detail += `Last Used: ${skill.last_used}\n`;

  if (skill.description) {
    detail += `\n=== DESCRIPTION / PROTOCOLS ===\n${skill.description}\n===============================\n`;
  }

  if (skill.contexts.length > 0) {
    detail += `Contexts: ${skill.contexts.join(", ")}\n`;
  }

  if (skill.learnings.length > 0) {
    detail += `Learnings:\n`;
    for (const l of skill.learnings) {
      detail += `  - ${l}\n`;
    }
  }

  detail += `====================`;
  return detail;
}
