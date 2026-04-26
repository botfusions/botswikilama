## 2025-04-19 - Path Traversal in Wiki Tools
**Vulnerability:** Path traversal and arbitrary file access via `vault_path` parameter in wiki tools.
**Learning:** Tools that accept file paths as arguments must be strictly sandboxed to prevent access to sensitive system files.
**Prevention:** Use `path.resolve` and validate the result against a safe root (like `os.homedir()`), while explicitly blocking `..` sequences.
