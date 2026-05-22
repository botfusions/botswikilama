## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** Unrestricted `vault_path` in wiki tools allowed reading and writing files anywhere on the filesystem.
**Learning:** MCP servers that handle local file paths must explicitly sandbox operations to a safe root (like the user's home directory) to prevent traversal attacks, especially when the LLM can influence path parameters.
**Prevention:** Use `path.resolve` to normalize paths, expand `~` manually if needed, and verify that the resulting absolute path starts with a trusted prefix followed by a path separator.

## 2025-05-16 - Symlink Path Traversal in Wiki Ingestion
**Vulnerability:** The `listRawFiles` function in wiki core used a recursive walk that followed symbolic links. This allowed an attacker to place a symlink inside the `raw/` directory pointing to sensitive files outside the vault, which would then be read and potentially ingested into the wiki.
**Learning:** When recursively traversing user-influenced directories, always check for symbolic links and skip them unless explicitly required and validated. Using `fs.readdirSync(..., { withFileTypes: true })` and checking `entry.isSymbolicLink()` is an efficient way to prevent this.
**Prevention:** Explicitly skip symbolic links during recursive file discovery in untrusted or user-provided directory structures.

## 2025-05-17 - YAML Injection in Markdown Frontmatter
**Vulnerability:** User-provided strings (titles, tags, etc.) were directly interpolated into YAML frontmatter in Wiki pages. A malicious string containing newlines and YAML syntax could inject arbitrary metadata fields or break the YAML block.
**Learning:** When generating YAML programmatically via string templates, any user-influenced value must be properly escaped and quoted. Simply stripping newlines is insufficient; double-quoting the value and escaping internal double-quotes and backslashes is the standard way to ensure a string is treated as a literal scalar.
**Prevention:** Use a dedicated sanitization helper like `sanitizeYamlValue` to wrap values in double quotes and escape `\`, `"`, and `\n` characters before including them in YAML templates.
