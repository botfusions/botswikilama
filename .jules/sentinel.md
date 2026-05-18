## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** Unrestricted `vault_path` in wiki tools allowed reading and writing files anywhere on the filesystem.
**Learning:** MCP servers that handle local file paths must explicitly sandbox operations to a safe root (like the user's home directory) to prevent traversal attacks, especially when the LLM can influence path parameters.
**Prevention:** Use `path.resolve` to normalize paths, expand `~` manually if needed, and verify that the resulting absolute path starts with a trusted prefix followed by a path separator.

## 2025-05-16 - Symlink Path Traversal in Wiki Ingestion
**Vulnerability:** The `listRawFiles` function in wiki core used a recursive walk that followed symbolic links. This allowed an attacker to place a symlink inside the `raw/` directory pointing to sensitive files outside the vault, which would then be read and potentially ingested into the wiki.
**Learning:** When recursively traversing user-influenced directories, always check for symbolic links and skip them unless explicitly required and validated. Using `fs.readdirSync(..., { withFileTypes: true })` and checking `entry.isSymbolicLink()` is an efficient way to prevent this.
**Prevention:** Explicitly skip symbolic links during recursive file discovery in untrusted or user-provided directory structures.

## 2026-05-18 - YAML Injection in Markdown Frontmatter
**Vulnerability:** User-controlled values (titles, file paths, project names) were embedded directly into YAML frontmatter of Markdown files without sanitization. This allowed an attacker to inject new YAML keys (e.g., `owner: admin`) or break the YAML structure by providing multi-line strings or unescaped quotes.
**Learning:** Even if data is not used in a traditional database, embedding it into structured formats like YAML or JSON requires proper escaping and quoting. YAML is particularly sensitive to indentation and newlines.
**Prevention:** Always sanitize user-provided values before embedding them in YAML. Wrapping values in double quotes and escaping backslashes, double quotes, and newlines is a robust way to ensure they are treated as literal strings.
