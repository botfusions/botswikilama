## 2025-05-03 - Wiki Path Traversal Protection
**Vulnerability:** Path traversal and unauthorized filesystem access via the `vault_path` parameter in Wiki tools.
**Learning:** MCP server tools that accept directory paths as input are vulnerable to creating or reading files anywhere the process has permissions (e.g., `/etc/passwd` or system directories). Standard `path.join` is insufficient for protection.
**Prevention:** Implement a strict path validation helper that: 1) Expands tildes (~) and resolves absolute paths. 2) Blocks `..` sequences in both raw and resolved forms. 3) Enforces a safe root (e.g., `os.homedir()`) using platform-aware prefix validation with `path.sep` to prevent "prefix bypass" attacks.
