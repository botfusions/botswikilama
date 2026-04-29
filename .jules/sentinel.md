# Sentinel Journal - Lemma MCP

## 2025-05-22 - Path Traversal in Wiki Tools
**Vulnerability:** The `wiki_*` tools (setup, ingest, query, lint) accept a `vault_path` parameter and use it directly in file system operations without validation, allowing for path traversal and arbitrary file writes/reads.
**Learning:** MCP tools that interact with the file system must always validate paths against a safe root directory to prevent escaping the intended workspace.
**Prevention:** Implement a `validateVaultPath` helper that resolves paths and ensures they stay within a permitted directory (e.g., the user's home directory) and explicitly blocks `..` sequences.
