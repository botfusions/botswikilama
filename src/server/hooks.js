// Hook system for Lemma MCP Server
// Allows registering callbacks for server lifecycle events
// Plus prompt modifiers for dynamic system prompt customization

/**
 * Hook types supported by the server
 */
export const HookTypes = {
  ON_START: "onStart",           // Called when server starts
  ON_PROJECT_CHANGE: "onProjectChange", // Called when project context changes
};

/**
 * Hook registry - stores registered callbacks
 */
const hooks = {
  [HookTypes.ON_START]: [],
  [HookTypes.ON_PROJECT_CHANGE]: [],
};

/**
 * Prompt modifier registry - functions that can modify system prompt
 * Each modifier receives (prompt, context) and returns modified prompt
 */
const promptModifiers = [];

/**
 * Register a hook callback
 * @param {string} hookType - Type of hook from HookTypes
 * @param {Function} callback - Async callback function
 * @returns {Function} Unregister function
 */
export function registerHook(hookType, callback) {
  if (!hooks[hookType]) {
    throw new Error(`Unknown hook type: ${hookType}`);
  }

  hooks[hookType].push(callback);

  // Return unregister function
  return () => {
    const index = hooks[hookType].indexOf(callback);
    if (index > -1) {
      hooks[hookType].splice(index, 1);
    }
  };
}

/**
 * Trigger all callbacks for a hook type
 * @param {string} hookType - Type of hook to trigger
 * @param {object} context - Context data passed to callbacks
 * @returns {Promise<Array>} Results from all callbacks
 */
export async function triggerHook(hookType, context = {}) {
  if (!hooks[hookType]) {
    throw new Error(`Unknown hook type: ${hookType}`);
  }

  const results = [];
  for (const callback of hooks[hookType]) {
    try {
      const result = await callback(context);
      results.push(result);
    } catch (error) {
      console.error(`Hook ${hookType} callback failed:`, error.message);
      results.push({ error: error.message });
    }
  }

  return results;
}

/**
 * Get registered hook count for a type
 * @param {string} hookType - Type of hook
 * @returns {number} Number of registered callbacks
 */
export function getHookCount(hookType) {
  return hooks[hookType]?.length || 0;
}

/**
 * Clear all hooks (useful for testing)
 */
export function clearHooks() {
  for (const hookType of Object.keys(hooks)) {
    hooks[hookType] = [];
  }
}

// ==================== PROMPT MODIFIERS ====================

/**
 * Register a prompt modifier function
 * @param {Function} modifier - Async function (prompt, context) => modifiedPrompt
 * @returns {Function} Unregister function
 */
export function registerPromptModifier(modifier) {
  if (typeof modifier !== "function") {
    throw new Error("Modifier must be a function");
  }

  promptModifiers.push(modifier);

  return () => {
    const index = promptModifiers.indexOf(modifier);
    if (index > -1) {
      promptModifiers.splice(index, 1);
    }
  };
}

/**
 * Apply all registered prompt modifiers
 * @param {string} prompt - Base prompt to modify
 * @param {object} context - Context data (project, fragments, etc.)
 * @returns {Promise<string>} Modified prompt
 */
export async function applyPromptModifiers(prompt, context = {}) {
  let modifiedPrompt = prompt;

  for (const modifier of promptModifiers) {
    try {
      modifiedPrompt = await modifier(modifiedPrompt, context);
    } catch (error) {
      console.error("Prompt modifier failed:", error.message);
    }
  }

  return modifiedPrompt;
}

/**
 * Get registered prompt modifier count
 * @returns {number} Number of registered modifiers
 */
export function getPromptModifierCount() {
  return promptModifiers.length;
}

/**
 * Clear all prompt modifiers (useful for testing)
 */
export function clearPromptModifiers() {
  promptModifiers.length = 0;
}
