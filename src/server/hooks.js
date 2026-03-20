// Hook system for Lemma MCP Server
// Allows registering callbacks for server lifecycle events

/**
 * Hook types supported by the server
 */
export const HookTypes = {
  ON_START: "onStart",           // Called when server starts
  ON_PROJECT_CHANGE: "onProjectChange", // Called when project context changes (future use)
};

/**
 * Hook registry - stores registered callbacks
 */
const hooks = {
  [HookTypes.ON_START]: [],
  [HookTypes.ON_PROJECT_CHANGE]: [],
};

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
