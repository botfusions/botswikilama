import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "lemma-server.log");

/**
 * Simple logger that writes to a file in the current directory
 * and also to stderr (to avoid interfering with MCP stdio transport)
 */
export const logger = {
  info: (message, context = {}) => {
    log("INFO", message, context);
  },
  error: (message, error = null, context = {}) => {
    const errorMsg = error instanceof Error ? error.message : error;
    log("ERROR", message, { ...context, error: errorMsg });
  },
  debug: (message, context = {}) => {
    log("DEBUG", message, context);
  }
};

function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const contextStr = Object.keys(context).length > 0 ? ` | ${JSON.stringify(context)}` : "";
  const logLine = `[${timestamp}] [${level}] ${message}${contextStr}\n`;

  try {
    // Write to file
    fs.appendFileSync(LOG_FILE, logLine, "utf-8");
    
    // Also log to stderr for visibility in host logs
    console.error(logLine.trim());
  } catch (err) {
    // Fallback to console if file writing fails
    console.error(`[Logger Error] Failed to write to log file: ${err.message}`);
    console.error(logLine.trim());
  }
}

export default logger;
