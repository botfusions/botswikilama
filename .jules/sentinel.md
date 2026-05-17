## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** Unrestricted `vault_path` in wiki tools allowed reading and writing files anywhere on the filesystem.
**Learning:** MCP servers that handle local file paths must explicitly sandbox operations to a safe root (like the user's home directory) to prevent traversal attacks, especially when the LLM can influence path parameters.
**Prevention:** Use `path.resolve` to normalize paths, expand `~` manually if needed, and verify that the resulting absolute path starts with a trusted prefix followed by a path separator.

## 2025-05-16 - Symlink Path Traversal in Wiki Ingestion
**Vulnerability:** The `listRawFiles` function in wiki core used a recursive walk that followed symbolic links. This allowed an attacker to place a symlink inside the `raw/` directory pointing to sensitive files outside the vault, which would then be read and potentially ingested into the wiki.
**Learning:** When recursively traversing user-influenced directories, always check for symbolic links and skip them unless explicitly required and validated. Using `fs.readdirSync(..., { withFileTypes: true })` and checking `entry.isSymbolicLink()` is an efficient way to prevent this.
**Prevention:** Explicitly skip symbolic links during recursive file discovery in untrusted or user-provided directory structures.

## 2025-05-17 - YAML Injection in Wiki Frontmatter
**Vulnerability:** User-provided values like titles and project names were directly interpolated into YAML frontmatter in Markdown files. This allowed an attacker to inject new YAML keys or break the document structure by including newlines or other special characters.
**Learning:** String interpolation is dangerous when generating structured formats like YAML. Even simple "title" fields can be exploited if they are not properly quoted and escaped for the target format. Double-quoted scalars in YAML are safe if backslashes, double quotes, and newlines are escaped.
**Prevention:** Always sanitize user-influenced values before placing them in structured files. Use a dedicated utility to wrap values in double quotes and escape special characters (backslash, double quote, newline) to ensure they remain within a single YAML field.
