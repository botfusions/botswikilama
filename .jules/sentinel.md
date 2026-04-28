# Sentinel Journal - Critical Security Learnings

## 2025-05-22 - Path Traversal in Wiki Tools
**Vulnerability:** Wiki tools (`wiki_setup`, `wiki_ingest`, `wiki_query`, `wiki_lint`) accepted a `vault_path` argument that was used directly with `fs` operations without validation. This allowed arbitrary file system access via absolute paths or `..` traversal sequences.
**Learning:** Even internal-use tools or local-first applications must treat user-provided paths as untrusted input, especially when they determine the root of file system operations.
**Prevention:** Implemented `validateVaultPath` which resolves the path, ensures it is contained within `os.homedir()`, and explicitly rejects `..` sequences in the raw input. All wiki handlers now use this validator.
