## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** Unrestricted `vault_path` in wiki tools allowed reading and writing files anywhere on the filesystem.
**Learning:** MCP servers that handle local file paths must explicitly sandbox operations to a safe root (like the user's home directory) to prevent traversal attacks, especially when the LLM can influence path parameters.
**Prevention:** Use `path.resolve` to normalize paths, expand `~` manually if needed, and verify that the resulting absolute path starts with a trusted prefix followed by a path separator.

## 2025-05-16 - Symlink Path Traversal in Wiki Ingestion
**Vulnerability:** The `listRawFiles` function in wiki core used a recursive walk that followed symbolic links. This allowed an attacker to place a symlink inside the `raw/` directory pointing to sensitive files outside the vault, which would then be read and potentially ingested into the wiki.
**Learning:** When recursively traversing user-influenced directories, always check for symbolic links and skip them unless explicitly required and validated. Using `fs.readdirSync(..., { withFileTypes: true })` and checking `entry.isSymbolicLink()` is an efficient way to prevent this.
**Prevention:** Explicitly skip symbolic links during recursive file discovery in untrusted or user-provided directory structures.

## 2025-05-21 - YAML Injection in Markdown Frontmatter
**Vulnerability:** User-provided inputs (titles, file paths, project names) were directly interpolated into YAML frontmatter blocks. This allowed an attacker to inject arbitrary YAML keys (e.g., `status: active` being overridden by an injected `status: archived`) by including a newline followed by the malicious key-value pair in the input string.
**Learning:** Never trust user input when generating structured data formats like YAML, even inside Markdown. Simple string interpolation is insufficient. Double-quoting values in YAML provides a first layer of defense, but characters like `\`, `"`, and especially `\n` must be escaped to prevent escaping the quoted context.
**Prevention:** Use a dedicated sanitization function for all values intended for YAML frontmatter. The function should escape backslashes, double quotes, and newlines, and wrap the final value in double quotes. For composite strings (e.g., `title: ${user_input} - Suffix`), sanitize the entire combined string as a single unit.
