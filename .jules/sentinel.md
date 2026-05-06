# Sentinel Journal - Lemma MCP

## 2025-05-22 - Path Traversal in Wiki Tools
**Vulnerability:** The Wiki tools (`wiki_setup`, `wiki_ingest`, `wiki_query`, `wiki_lint`) accepted a `vault_path` argument that was used directly for filesystem operations, allowing an LLM or a user to manipulate files anywhere on the system (path traversal). Additionally, `project_name` in `wiki_setup` could be used to inject path separators.
**Learning:** Tools that accept filesystem paths as arguments must always validate them against a trusted root directory. Relying on the LLM to provide "safe" paths is not a security control.
**Prevention:** Resolved the issue by implementing `validateVaultPath` which resolves the path and ensures it starts with the user's home directory (`os.homedir()`). Added validation for `project_name` to reject invalid characters.
