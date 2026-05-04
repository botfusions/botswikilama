## 2026-05-04 - Path Traversal in Wiki Tools
**Vulnerability:** Path traversal via `vault_path` and `project_name` arguments in wiki tools (setup, ingest, query, lint).
**Learning:** MCP server tools that accept file paths as input must strictly validate them against a safe root directory. Resolving paths without a prefix check can expose the entire filesystem.
**Prevention:** Use `path.resolve` and ensure the result starts with a trusted directory (e.g., user's home directory). Explicitly block '..' sequences and sanitize inputs used in filename generation.
