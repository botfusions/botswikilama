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

## 2025-05-22 - Symlink Path Traversal in Wiki Query and Lint
**Vulnerability:** The `listFiles` function in wiki core used a flat directory listing that followed symbolic links. This allowed an attacker to place a symlink inside the wiki's managed directories (like `sources/`) pointing to sensitive files outside the vault, which would then be searchable via `wiki_query` or reported in `wiki_lint`.
**Learning:** Even when not performing a recursive walk, symbolic links can still lead to path traversal if they point outside the intended root. File discovery utilities should explicitly filter for regular files or validate symlink targets.
**Prevention:** Use `fs.readdirSync(..., { withFileTypes: true })` and filter for `entry.isFile()` to ignore symbolic links during file discovery in wiki directories.

## 2025-05-23 - Prototype Pollution in Recursive Config Merging
**Vulnerability:** The `deepMerge` function used for loading user configuration was vulnerable to Prototype Pollution. While it used object spreads for the target, it recursively merged source keys without validating them, allowing special keys like `__proto__` or `constructor` to modify the prototype of the resulting configuration object.
**Learning:** Recursive merge functions must always explicitly block sensitive keys like `__proto__`, `constructor`, and `prototype`. Even when using patterns like `{...target}` which protect the global `Object.prototype` from direct pollution, the resulting merged object can still have its own prototype chain corrupted if these keys are processed.
**Prevention:** Implement an explicit blocklist for sensitive keys (`__proto__`, `constructor`, `prototype`) in all recursive object merging or property assignment logic.

## 2025-05-24 - DoS Protection via Input Length Validation
**Vulnerability:** Lack of length validation on user-provided strings in tool arguments (fragments, titles, descriptions, queries) could lead to memory exhaustion or DoS.
**Learning:** MCP tools that accept free-form text must enforce reasonable upper bounds on input sizes to protect the server process and downstream processing (like fuzzy search or file I/O) from resource exhaustion.
**Prevention:** Implement a centralized validation helper and apply it to all tool handlers that accept user-influenced strings, returning clear error messages when limits are exceeded.

## 2025-05-25 - DoS Protection in Backups and Array Arguments
**Vulnerability:** Unbounded growth of `.bak` files and lack of item count limits in array arguments allowed for potential disk and memory exhaustion.
**Learning:** Persistence layers with automated backup mechanisms must enforce caps on backup size to prevent DoS. Similarly, tool handlers accepting arrays must validate both the number of items and their individual lengths to ensure predictable resource usage.
**Prevention:** Implement a hard limit (e.g., 1000 entries) for rolling backups using `.slice()`. Use centralized validation helpers for both string lengths and array item counts across all API entry points.
