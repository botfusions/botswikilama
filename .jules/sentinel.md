## 2025-05-15 - Path Traversal in Wiki Tools
**Vulnerability:** Path traversal in `wiki_setup`, `wiki_ingest`, `wiki_query`, and `wiki_lint` allowed creating vaults and ingesting files outside the intended user directory.
**Learning:** Input paths were used directly in `path.join` and filesystem operations without validation. `path.resolve` alone is not enough as it still allows paths within the home directory that use `..` to access other sensitive areas if not explicitly blocked.
**Prevention:** Always validate user-provided paths using `path.resolve` against a safe root (like `os.homedir()`) and explicitly block '..' sequences to prevent traversal vulnerabilities.
