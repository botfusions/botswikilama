## 2025-05-14 - Path Traversal Protection in Wiki Tools
**Vulnerability:** Wiki tools (`wiki_setup`, `wiki_ingest`, `wiki_query`, `wiki_lint`) accepted a `vault_path` argument that was used in filesystem operations without validation. This allowed an attacker to read or write files anywhere on the system the process had access to by using path traversal sequences like `..`.
**Learning:** Path traversal is a common risk when exposing filesystem-related tools to LLMs. Even if the LLM is "trusted", the input it processes might come from untrusted sources or it might be manipulated.
**Prevention:** Always validate user-provided paths. In this implementation, we added `validateVaultPath` which:
1. Resolves the path to its absolute form.
2. Ensures the resolved path is within the user's home directory (`os.homedir()`).
3. Explicitly blocks the string `..` in the input to prevent obfuscated traversal attempts.
