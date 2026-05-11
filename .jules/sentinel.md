## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** Unrestricted `vault_path` in wiki tools allowed reading and writing files anywhere on the filesystem.
**Learning:** MCP servers that handle local file paths must explicitly sandbox operations to a safe root (like the user's home directory) to prevent traversal attacks, especially when the LLM can influence path parameters.
**Prevention:** Use `path.resolve` to normalize paths, expand `~` manually if needed, and verify that the resulting absolute path starts with a trusted prefix followed by a path separator.

## 2025-05-16 - Symlink Path Traversal in Wiki Ingestion
**Vulnerability:** The `listRawFiles` function in wiki core used a recursive walk that followed symbolic links. This allowed an attacker to place a symlink inside the `raw/` directory pointing to sensitive files outside the vault, which would then be read and potentially ingested into the wiki.
**Learning:** When recursively traversing user-influenced directories, always check for symbolic links and skip them unless explicitly required and validated. Using `fs.readdirSync(..., { withFileTypes: true })` and checking `entry.isSymbolicLink()` is an efficient way to prevent this.
**Prevention:** Explicitly skip symbolic links during recursive file discovery in untrusted or user-provided directory structures.

## 2026-05-11 - YAML Injection in Wiki Frontmatter
**Vulnerability:** User-controlled inputs like titles, file paths, and entity names were directly inserted into Markdown YAML frontmatter. This allowed attackers to break out of the frontmatter or inject arbitrary YAML keys by including newlines and YAML delimiters (`---`).
**Learning:** When generating YAML or other structured formats via string concatenation, always sanitize user input. For YAML double-quoted scalars, this involves escaping backslashes, double quotes, and newlines, and wrapping the value in double quotes.
**Prevention:** Use a dedicated sanitization helper like `sanitizeYamlValue` for all user-provided data that ends up in YAML frontmatter. This ensures that special characters are treated as literal strings rather than structural YAML elements.
