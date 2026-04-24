## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** The Wiki tools (`wiki_setup`, `wiki_ingest`, etc.) allowed arbitrary `vault_path` arguments, which could lead to path traversal or unauthorized file access/creation outside the intended directory.
**Learning:** MCP servers that interact with the local filesystem must strictly validate user-provided paths, especially when they are not hardcoded.
**Prevention:** Use `path.resolve` and verify the path is within a designated safe root (e.g., `os.homedir()`). Additionally, explicitly block '..' sequences in the raw input string as defense-in-depth against traversal.
