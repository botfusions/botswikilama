# Sentinel Journal

## 2025-05-22 - Path Traversal Protection in Wiki Tools
**Vulnerability:** Wiki tools (setup, ingest, query, lint) accepted arbitrary `vault_path` arguments, allowing for path traversal (using `..`) and access to sensitive system or user files outside the intended scope.
**Learning:** Even if a tool is intended for local use, allowing unvalidated user-provided paths can lead to significant security risks, especially if the tool is exposed via an MCP server that might be used by an LLM which could be manipulated.
**Prevention:** Always resolve user-provided paths and validate them against a safe root directory (like `os.homedir()`). Explicitly forbid `..` sequences in path strings to prevent traversal even before resolution. Use `path.sep` to ensure prefix matching only happens on full directory boundaries.
