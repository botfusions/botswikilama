# Sentinel Journal - Lemma MCP

## 2025-05-15 - Path Traversal in Wiki Tools
**Vulnerability:** Wiki tools (`wiki_setup`, `wiki_ingest`, `wiki_query`, `wiki_lint`) accepted arbitrary `vault_path` arguments without validation, allowing potential path traversal or access to sensitive areas outside the intended home directory.
**Learning:** MCP tools that interact with the file system must always validate paths, especially when the path is provided by the LLM/user.
**Prevention:** Implement a strict `validateVaultPath` helper that checks for `..` sequences and ensures the resolved path is within a safe root (e.g., `os.homedir()`).
