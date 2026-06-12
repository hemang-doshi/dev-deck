# Changelog

All notable changes to DevDeck are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

## 1.4.0 - Compact Agent Output

### Added

- Agent-first CLI workflow for local development stacks.
- Background session startup with `devdeck start`.
- Foreground development mode with `devdeck dev`.
- Service state inspection with `devdeck status`.
- Machine-readable state output through `devdeck status --json`.
- Bounded log inspection with `devdeck logs`.
- Compact stack snapshots with `devdeck snapshot`.
- Compact `--agent` output modes for `status`, `snapshot`, and `logs`.
- Service-level control with `devdeck service start`, `devdeck service stop`, and `devdeck service restart`.
- Full stack shutdown with `devdeck stop`.
- Agent onboarding through `LLMs.md`.
- Human onboarding through `HUMANs.md`.
- Structured `DD-ERR-XXXX` diagnostic error-code documentation.
- Local dashboard for visual service monitoring.

### Changed

- Repositioned DevDeck as an agent-first local runtime control plane.
- Updated documentation to use the published package name: `@hemangdoshi/devdeck`.

### Notes

This release establishes DevDeck as a usable working CLI for agent-first local development orchestration.

This release adds the first compact agent-output architecture slice and benchmark modes for agent-facing runtime inspection.

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
