## 2025-05-15 - Wiki Path Traversal Protection
**Vulnerability:** Unrestricted `vault_path` in wiki tools allowed reading and writing files anywhere on the filesystem.
**Learning:** MCP servers that handle local file paths must explicitly sandbox operations to a safe root (like the user's home directory) to prevent traversal attacks, especially when the LLM can influence path parameters.
**Prevention:** Use `path.resolve` to normalize paths, expand `~` manually if needed, and verify that the resulting absolute path starts with a trusted prefix followed by a path separator.

## 2025-05-16 - Symlink Path Traversal in Wiki Ingestion
**Vulnerability:** The `listRawFiles` function in wiki core used a recursive walk that followed symbolic links. This allowed an attacker to place a symlink inside the `raw/` directory pointing to sensitive files outside the vault, which would then be read and potentially ingested into the wiki.
**Learning:** When recursively traversing user-influenced directories, always check for symbolic links and skip them unless explicitly required and validated. Using `fs.readdirSync(..., { withFileTypes: true })` and checking `entry.isSymbolicLink()` is an efficient way to prevent this.
**Prevention:** Explicitly skip symbolic links during recursive file discovery in untrusted or user-provided directory structures.

## 2025-05-17 - YAML Injection in Markdown Frontmatter
**Vulnerability:** User-controlled variables were directly interpolated into template strings used to generate YAML frontmatter in Markdown files. This allowed an attacker to inject new YAML fields or hijack existing ones by using newline characters.
**Learning:** Even if a file is primarily Markdown, its frontmatter is often YAML. Treating frontmatter as simple string interpolation is dangerous if any part of the string comes from an untrusted source.
**Prevention:** Always sanitize or escape values placed in YAML frontmatter. Wrapping values in double quotes and escaping existing double quotes, backslashes, and newlines (using a helper like sanitizeYamlValue) is an effective way to prevent injection in double-quoted scalars.
