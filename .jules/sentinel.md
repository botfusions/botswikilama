## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** Unrestricted `vault_path` in wiki tools allowed reading and writing files anywhere on the filesystem.
**Learning:** MCP servers that handle local file paths must explicitly sandbox operations to a safe root (like the user's home directory) to prevent traversal attacks, especially when the LLM can influence path parameters.
**Prevention:** Use `path.resolve` to normalize paths, expand `~` manually if needed, and verify that the resulting absolute path starts with a trusted prefix followed by a path separator.

## 2025-05-16 - Symlink Path Traversal in Wiki Ingestion
**Vulnerability:** The `listRawFiles` function in wiki core used a recursive walk that followed symbolic links. This allowed an attacker to place a symlink inside the `raw/` directory pointing to sensitive files outside the vault, which would then be read and potentially ingested into the wiki.
**Learning:** When recursively traversing user-influenced directories, always check for symbolic links and skip them unless explicitly required and validated. Using `fs.readdirSync(..., { withFileTypes: true })` and checking `entry.isSymbolicLink()` is an efficient way to prevent this.
**Prevention:** Explicitly skip symbolic links during recursive file discovery in untrusted or user-provided directory structures.

## 2025-05-20 - YAML Injection in Wiki Frontmatter
**Vulnerability:** User-provided values (titles, project names, file paths) were directly concatenated into YAML frontmatter in Markdown files. This allowed attackers to inject arbitrary YAML keys or break the document structure using newlines and special characters.
**Learning:** Never trust user input when generating structured data formats like YAML, even if it's "just" Markdown frontmatter. Simple string concatenation is insufficient for security.
**Prevention:** Always sanitize or quote user-provided values for YAML. Use a helper function to wrap values in double quotes and escape backslashes, double quotes, and newlines. When building composite strings (e.g., "Title — Suffix"), sanitize the entire final string as a single unit.
