# Sentinel Journal - Lemma MCP

## 2025-02-22 - Path Traversal in Wiki Tools
**Vulnerability:** The Wiki tools (`wiki_setup`, `wiki_ingest`, `wiki_query`, `wiki_lint`) accepted a `vault_path` parameter from the user without sufficient validation. This allowed an attacker to provide paths containing `..` sequences to access or create files outside of the intended directory structure (path traversal). Additionally, `wiki_setup` did not validate the `project_name` parameter, which was used in path construction.

**Learning:** When an application exposes tools that interact with the filesystem based on user-provided paths, it is critical to enforce a "jail" or root directory. Simply checking for `..` is often insufficient; resolving the absolute path and verifying it against a trusted prefix is the most robust approach.

**Prevention:**
1. Always resolve user-provided paths to absolute paths using `path.resolve()`.
2. Explicitly block `..` sequences even before resolution to prevent certain classes of attacks.
3. Validate that the resolved absolute path starts with a trusted directory prefix (e.g., `os.homedir()`).
4. Use platform-aware path separators (`path.sep`) when constructing validation prefixes to avoid partial name matches (e.g., `/home/user` vs `/home/user_extra`).
5. Sanitize all parameters used in path construction, such as project names or slugs.
