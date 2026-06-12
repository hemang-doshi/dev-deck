# Changelog

All notable changes to DevDeck are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

## [1.3.0] — 2026-06-13

### Added

- Config v2 schema, normalization, and validation pipeline for `devdeck.config` files, including dependency-graph validation and compatibility coverage for v1-era inputs.
- New CLI configuration workflows with `devdeck config validate` and `devdeck config explain`, plus richer config and `.env` inspection output.
- Runtime orchestration upgrades for agent-first sessions, including session inspection helpers, structured agent response envelopes, and a canonical event store.
- Expanded health and readiness probe support across the core runtime and server APIs.

### Fixed

- Hardened CLI runtime contract handling for agent responses and normalized service definitions.
- Improved dashboard and backend health checks, including loopback probe behavior for IPv6 services and more reliable test storage setup.

## [1.1.0] — 2026-05-23

### Changed

- **Terminal-style log stream** — the dashboard log stream has been redesigned with a flat terminal aesthetic while the overall tile workspace layout (drag-to-reorder, resize, recolor, add/remove tiles) remains unchanged.
  - Each log entry now shows a metadata row of `timestamp · service pill · severity · stream type` followed by a monospace `pre` block for the log line
  - Left-border severity coloring: rose for errors, amber for warnings, cyan/dim for info
  - Stack-trace continuation lines are indented and grouped visually under their parent entry
  - The stream toolbar shows a live state icon, connection badge, and line count
  - Reconnecting banner preserved from previous design
  - Empty and loading states use the same terminal dark palette

### Fixed

- Subtitle text was being rendered inside an uppercase/letter-spaced CSS context, causing it to display incorrectly — moved to its own row below the stream label
- `border-l` Tailwind class conflict on stack-trace log rows — severity tone border now only applies to non-stack-trace rows to avoid specificity collisions
- Loading skeleton height was unconstrained (Card collapsed to near-zero before first logs arrived) — both skeleton and empty-state sections now have a minimum height
- Simplified React key on log articles from `timestamp-id` composite to `id` alone (sequential integer, globally unique)
- Removed unused `tileBadgeClass` dead code from `dashboard-shell.tsx`

## [1.0.0] — 2026-05-09

Initial public release of DevDeck.
