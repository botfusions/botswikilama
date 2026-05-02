# Sentinel's Journal

## 2025-05-22 - Path Traversal in Wiki Tools
**Vulnerability:** The `vault_path` parameter in wiki tools (`wiki_setup`, `wiki_ingest`, `wiki_query`, `wiki_lint`) allowed arbitrary filesystem access, including path traversal via `..` sequences.
**Learning:** Tools that accept filesystem paths must always validate them against a safe root and sanitize inputs to prevent traversal.
**Prevention:** Implement a robust `validateVaultPath` helper that resolves paths and ensures they remain within a designated safe directory (e.g., `os.homedir()`).
