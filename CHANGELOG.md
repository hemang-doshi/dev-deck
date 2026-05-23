# Changelog

All notable changes to DevDeck are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

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
