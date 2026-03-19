# Changelog

## [0.2.3] - 2026-03-19

### Fixed
- **Critical: Memory data loss from decay** — `decayConfidence()` was permanently removing fragments with confidence below 0.1 from disk. Decay now only reduces confidence scores; fragments are never removed implicitly. Deletion is exclusive to `memory_forget` and `memory_merge` (explicit user actions).
- **Critical: Backup overwrite on same-count save** — When new data had the same number of entries as the backup but different IDs, the backup was silently overwritten, losing unique entries. Backup is now cumulative (ID-based merge) — it only adds new entries and never removes existing ones.
- **Critical: Backup overwrite after count recovery** — After decay reduced entries and new additions brought the count back up, the backup was overwritten with data missing decayed entries. Cumulative backup prevents this entirely.
- **saveMemory(null/undefined/[]) protection** — Empty, null, or undefined arrays are now rejected before writing, preventing accidental file wipe.

### Changed
- **Backup system rewritten** — Both `memory.jsonl.bak` and `guides.jsonl.bak` now use cumulative merging instead of overwrite. The backup grows over time but never loses entries.
- **Test suite added** — Comprehensive memory test suite (110 tests) covering all tools, decay behavior, backup safety, and data loss scenarios.

## [0.2.2] - 2026-03-18

### Added
- **memory_merge Tool**: Merge multiple memory fragments into one to consolidate duplicates. Creates new ID, deletes originals.
- **guide_merge Tool**: Merge multiple guides into one. Auto-merges contexts, learnings, and sums usage counts.
- **Auto-backup**: Both `memory.jsonl` and `guides.jsonl` are automatically backed up to `.bak` on every save.

### Changed
- **System Prompt**: Rewritten identity section — clearer, explanatory, non-mandatory tone
- **System Prompt**: Expanded guide tracking section with detailed explanations (memory vs guide, categories, merge tools)
- **System Prompt**: Added "Discovering Technologies" recommendation for manual project analysis via `package.json`

### Removed
- **guide_discover Tool**: Removed in favor of manual discovery. System prompt now recommends reading `package.json` directly and using `guide_practice` to register technologies.

---

## [0.2.0] - 2026-03-15

### Breaking Changes
- **Skill → Guide Rename**: Complete terminology migration across the entire codebase
  - All tool names renamed: `skill_*` → `guide_*`
    - `skill_get` → `guide_get`
    - `skill_practice` → `guide_practice`
    - `skill_create` → `guide_create`
    - `skill_suggest` → `guide_suggest`
    - `skill_discover` → `guide_discover`
  - Directory renamed: `src/skills/` → `src/guides/`
  - Export path changed: `./skills` → `./guides`
  - URI pattern changed: `lemma://skills/` → `lemma://guides/`
  - Data file changed: `skills.jsonl` → `guides.jsonl`
  - ID prefix changed: `s1a2b3` → `g1a2b3`

### Migration Guide
- Rename your data file: `~/.lemma/skills.jsonl` → `~/.lemma/guides.jsonl`
- Update any MCP client configurations referencing skill tools
- Existing `SKILL.md` files remain compatible for import

---

## [0.1.4] - 2025-03-12

### Changed
- **MCP Resources Refactor**: Memory fragments and skills are now exposed as individual resources instead of bulk endpoints
  - `list_resources` returns each record with metadata (title, description, scope)
  - `read_resource` fetches only the requested single record
- **New URI Patterns**:
  - `lemma://memory/{id}` - Single memory fragment by ID
  - `lemma://skills/{name}` - Single skill by name
- This change reduces unnecessary token consumption when working with large datasets

## [0.1.3] - 2025-03-12

### Added
- **Skill Categories**: Granular and structured skill categories for better organization
  - Web: `web-frontend`, `web-backend`, `data-storage`, `dev-tool`
  - Mobile: `mobile-frontend`
  - Game: `game-frontend`, `game-backend`, `game-tool`, `game-design`
  - Cross-cutting: `app-security`, `ui-design`, `infra-devops`, `programming-language`
- **skill_distill Tool**: Promote memory fragments into reusable skills
- **skill_update Tool**: Update existing skill properties
- **skill_forget Tool**: Remove skills from tracking
- **System Prompt Resource**: LLM identity, workflow, and rules exposed via `lemma://system-prompt`
- **JSR Installation**: Added JSR configuration and installation guide

### Changed
- Core workflow redefined to integrate skill suggestion and practice
- Removed Smithery.ai distribution instructions
- Prioritized JSR as primary installation method

### Removed
- Legacy memory and skills core modules and their associated tests

## [0.1.2] - 2025-03-08

### Added
- **Fuzzy Search**: Skill suggestions now use Fuse.js for typo-tolerant, partial matching
- **Documentation**: Added research papers on Agentic Memory and Self-Distillation
- **Tests**: Inline Fuse.js mock for testing

## [0.1.1] - 2025-03-07

### Added
- **skill_create Tool**: Create new skills with detailed manuals
- **skill_suggest Tool**: Suggest relevant skills based on task description
- **Token-based Matching**: Improved skill suggestion across names, keywords, contexts, and learnings
- **Description Field**: Added `description` field to `skill_practice` for detailed skill management
- **Mandatory Fields**: Made `skill_practice` contexts and learnings mandatory

### Changed
- **System Prompt**: Restructured with XML tags, condensed and optimized
- **memory_add**: Changed project default from auto-detection to explicit global scope (null)

### Fixed
- Full skill details now provided on update

## [0.1.0] - 2025-03-05

### Added
- **Initial Release**: Lemma MCP memory system with project scoping
- **Memory Tools**:
  - `memory_read` - Read memory fragments with optional query
  - `memory_check` - Check if memory exists for a project
  - `memory_add` - Add new memory fragments
  - `memory_update` - Update existing fragments
  - `memory_forget` - Remove fragments
  - `memory_list` - List all fragments
- **Project Scoping**: Memory fragments can be scoped to specific projects or global
- **Confidence Decay**: Time-based confidence decay for memory relevance
- **lastAccessed Field**: Track when fragments were last accessed
- **MANDATORY Flags**: Tool descriptions include mandatory parameter flags
- **Zero-install Method**: Support for npx and GitHub installation
- **MIT License**
- **Turkish Translation**: Full README in Turkish

### Documentation
- Self-Distillation Enables Continual Learning research paper
- Tool descriptions and usage examples

---

[0.2.3]: https://github.com/xenitV1/lemma/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/xenitV1/lemma/compare/v0.2.0...v0.2.2
[0.1.4]: https://github.com/xenitV1/lemma/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/xenitV1/lemma/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/xenitV1/lemma/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/xenitV1/lemma/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xenitV1/lemma/releases/tag/v0.1.0
