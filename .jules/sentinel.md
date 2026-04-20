## 2025-05-22 - [Path Traversal in Wiki Tools]
**Vulnerability:** User-provided `vault_path` was used directly with `path.join` and `fs` operations without validation in wiki tool handlers, allowing arbitrary file system access.
**Learning:** Even internal-use tools like wiki generators can be entry points for path traversal if they accept absolute or relative paths from the user.
**Prevention:** Always normalize and validate user-provided paths to ensure they don't contain traversal sequences like `..` before using them in file system operations.
