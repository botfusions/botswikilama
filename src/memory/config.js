import os from "os";
import path from "path";
import fs from "fs";

const CONFIG_PATH = path.join(os.homedir(), ".lemma", "config.json");

const DEFAULT_CONFIG = {
  token_budget: {
    full_content: 3000,
    summary_index: 1000,
    guides_detail: 1000,
  },
  injection: {
    max_full_content_fragments: 15,
    max_summary_fragments: 30,
    max_guides: 20,
    max_guide_detail: 3,
  },
  virtual_session: {
    timeout_minutes: 30,
  },
};

let _config = null;
let _configDir = null;

export function setConfigDir(dir) {
  _configDir = dir;
}

function getConfigPath() {
  return _configDir ? path.join(_configDir, "config.json") : CONFIG_PATH;
}

export function loadConfig() {
  if (_config) return _config;
  
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const userConfig = JSON.parse(raw);
      _config = deepMerge(DEFAULT_CONFIG, userConfig);
    } else {
      _config = { ...DEFAULT_CONFIG };
    }
  } catch {
    _config = { ...DEFAULT_CONFIG };
  }
  
  return _config;
}

export function resetConfig() {
  _config = null;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}
