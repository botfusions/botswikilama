## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** User-provided `vault_path` in Wiki tools allowed arbitrary file system access via path traversal (e.g., `../`).
**Learning:** Even if a path is resolved, it must be verified against a safe root directory (like `os.homedir()`) to ensure it stays within the intended sandbox. Explicitly blocking `..` sequences provides an additional layer of protection against unexpected resolution behavior.
**Prevention:** Implement a centralized path validation helper for any tool that accepts file system paths, ensuring the resolved path is a sub-path of a pre-defined safe root.
