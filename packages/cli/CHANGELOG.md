# Changelog

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
