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

## 2025-05-26 - DoS Protection via Backup File Capping
**Vulnerability:** Cumulative backup files (.bak) for memory, guides, and sessions grew unbounded with every unique entry added. This could lead to disk exhaustion and high memory usage during the backup merge process.
**Learning:** Persistence layers that implement append-only or cumulative backups must have hard limits on history retention. Even small entries can eventually cause a Denial-of-Service if the total count is allowed to grow indefinitely.
**Prevention:** Implement a hard cap on the number of entries kept in cumulative backups (e.g., 1000) by slicing the merged array before writing to disk.

## 2025-05-24 - DoS Protection via Input Length Validation
**Vulnerability:** Lack of length validation on user-provided strings in tool arguments (fragments, titles, descriptions, queries) could lead to memory exhaustion or DoS.
**Learning:** MCP tools that accept free-form text must enforce reasonable upper bounds on input sizes to protect the server process and downstream processing (like fuzzy search or file I/O) from resource exhaustion.
**Prevention:** Implement a centralized validation helper and apply it to all tool handlers that accept user-influenced strings, returning clear error messages when limits are exceeded.

## 2025-05-25 - DoS Protection via Array Count Validation
**Vulnerability:** Tool handlers accepting array arguments (e.g., ids, entities, technologies) lacked validation on the number of items provided. An attacker could provide an extremely large array, leading to high memory consumption or CPU exhaustion during processing.
**Learning:** For MCP tools, validating the count of items in array parameters is as critical as validating the length of string parameters for DoS prevention.
**Prevention:** Implement a centralized validateCounts helper and apply it to all tool handlers that accept array inputs, enforcing reasonable upper bounds based on the tool's purpose.

## 2025-06-01 - Markdown Header and Rule Injection
**Vulnerability:** User-provided inputs were interpolated into Markdown headers and rule definitions in generated files like `CLAUDE.md`. By including newlines and Markdown syntax, an attacker could inject unauthorized instructions or overwrite existing rules that guide the LLM's behavior.
**Learning:** Even when output is "just" Markdown, newlines in user-supplied strings can break the structural integrity of the document, especially when those strings are used in sensitive areas like headers or rule lists that define operational boundaries for the AI.
**Prevention:** Use a dedicated sanitization function that strips all newline characters from user input before embedding it into Markdown structures where line breaks have semantic meaning.

## 2025-06-03 - Persistent Path Disclosure in Wiki Files
**Vulnerability:** Absolute home directory paths were being written to persistent Wiki files (logs, lint reports, and source metadata), leaking the server's internal directory structure and username.
**Learning:** Redacting paths in tool responses is insufficient if the same absolute paths are still stored in files generated or managed by those tools. Persistent storage must be sanitized with the same rigour as transient output to prevent Information Exposure.
**Prevention:** Apply a shared `redactPath` utility to all user-controllable absolute paths before they are written to disk in persistent files or returned in responses.

## 2025-06-05 - DoS Protection via Individual Array Item Validation
**Vulnerability:** While array count and overall string length were validated, individual string items within arrays (e.g., technologies, lessons, entities) were not checked. An attacker could provide a valid number of items where each item was extremely large, leading to high memory usage or downstream processing issues.
**Learning:** For MCP tools accepting arrays of strings, validating the total count of items is insufficient if the individual item size is not also capped.
**Prevention:** Implement a `validateArrayItems` helper and apply it to all handlers that process array arguments, enforcing length limits on every element.

## 2026-06-22 - Absolute Path Disclosure in LLM-facing Components
**Vulnerability:** Absolute home directory paths were disclosed to LLMs through dynamic system prompts, tool descriptions, instructions, and JSON resource content.
**Learning:** Redacting paths in tool *responses* is insufficient if the same data is injected into the model's context via system prompts or metadata. LLM-facing components must have a central redaction layer.
**Prevention:** Apply a global `redactPath` utility to all dynamic strings before they are returned to the LLM as part of the system prompt, tool definitions, or resources.
