# Sentinel Journal 🛡️

Critical security learnings and repository-specific patterns for Lemma.

## 2025-04-30 - Path Traversal in Wiki Module
**Vulnerability:** The Wiki tools (wiki_setup, wiki_ingest, etc.) allowed arbitrary `vault_path` arguments, which could be used for path traversal (using `..`) or creating/modifying files outside of the expected user directory.
**Learning:** MCP tools that interact with the filesystem must strictly validate user-provided paths. Relying on the LLM to provide "safe" paths is not a security control.
**Prevention:** Always validate user-provided paths using a helper like `validateVaultPath` that resolves the path, ensures it is within a safe root (like `os.homedir()`), and explicitly blocks '..' sequences.
